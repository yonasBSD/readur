use anyhow::Result;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use std::sync::Arc;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Duration};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::{db::Database, ocr::OcrService};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OcrQueueItem {
    pub id: Uuid,
    pub document_id: Uuid,
    pub status: String,
    pub priority: i32,
    pub attempts: i32,
    pub max_attempts: i32,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
    pub worker_id: Option<String>,
    pub processing_time_ms: Option<i32>,
    pub file_size: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStats {
    pub pending_count: i64,
    pub processing_count: i64,
    pub failed_count: i64,
    pub completed_today: i64,
    pub avg_wait_time_minutes: Option<f64>,
    pub oldest_pending_minutes: Option<f64>,
}

pub struct OcrQueueService {
    db: Database,
    pool: PgPool,
    max_concurrent_jobs: usize,
    worker_id: String,
}

impl OcrQueueService {
    pub fn new(db: Database, pool: PgPool, max_concurrent_jobs: usize) -> Self {
        let worker_id = format!("worker-{}-{}", hostname::get().unwrap_or_default().to_string_lossy(), Uuid::new_v4());
        Self {
            db,
            pool,
            max_concurrent_jobs,
            worker_id,
        }
    }

    /// Add a document to the OCR queue
    pub async fn enqueue_document(&self, document_id: Uuid, priority: i32, file_size: i64) -> Result<Uuid> {
        let id = sqlx::query_scalar!(
            r#"
            INSERT INTO ocr_queue (document_id, priority, file_size)
            VALUES ($1, $2, $3)
            RETURNING id
            "#,
            document_id,
            priority,
            file_size
        )
        .fetch_one(&self.pool)
        .await?;

        info!("Enqueued document {} with priority {} for OCR processing", document_id, priority);
        Ok(id)
    }

    /// Batch enqueue multiple documents
    pub async fn enqueue_documents_batch(&self, documents: Vec<(Uuid, i32, i64)>) -> Result<Vec<Uuid>> {
        let mut ids = Vec::new();
        
        // Use a transaction for batch insert
        let mut tx = self.pool.begin().await?;
        
        for (document_id, priority, file_size) in documents {
            let id = sqlx::query_scalar!(
                r#"
                INSERT INTO ocr_queue (document_id, priority, file_size)
                VALUES ($1, $2, $3)
                RETURNING id
                "#,
                document_id,
                priority,
                file_size
            )
            .fetch_one(&mut *tx)
            .await?;
            
            ids.push(id);
        }
        
        tx.commit().await?;
        
        info!("Batch enqueued {} documents for OCR processing", ids.len());
        Ok(ids)
    }

    /// Get the next item from the queue
    async fn dequeue(&self) -> Result<Option<OcrQueueItem>> {
        let item = sqlx::query_as!(
            OcrQueueItem,
            r#"
            UPDATE ocr_queue
            SET status = 'processing',
                started_at = NOW(),
                worker_id = $1,
                attempts = attempts + 1
            WHERE id = (
                SELECT id
                FROM ocr_queue
                WHERE status = 'pending'
                  AND attempts < max_attempts
                ORDER BY priority DESC, created_at ASC
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            RETURNING *
            "#,
            &self.worker_id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(item)
    }

    /// Mark an item as completed
    async fn mark_completed(&self, item_id: Uuid, processing_time_ms: i32) -> Result<()> {
        sqlx::query!(
            r#"
            UPDATE ocr_queue
            SET status = 'completed',
                completed_at = NOW(),
                processing_time_ms = $2
            WHERE id = $1
            "#,
            item_id,
            processing_time_ms
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Mark an item as failed
    async fn mark_failed(&self, item_id: Uuid, error: &str) -> Result<()> {
        let result = sqlx::query!(
            r#"
            UPDATE ocr_queue
            SET status = CASE 
                    WHEN attempts >= max_attempts THEN 'failed'
                    ELSE 'pending'
                END,
                error_message = $2,
                started_at = NULL,
                worker_id = NULL
            WHERE id = $1
            RETURNING status
            "#,
            item_id,
            error
        )
        .fetch_one(&self.pool)
        .await?;

        if result.status == Some("failed".to_string()) {
            error!("OCR job {} permanently failed after max attempts: {}", item_id, error);
        }

        Ok(())
    }

    /// Process a single queue item
    async fn process_item(&self, item: OcrQueueItem, ocr_service: &OcrService) -> Result<()> {
        let start_time = std::time::Instant::now();
        
        info!("Processing OCR job {} for document {}", item.id, item.document_id);
        
        // Get document details
        let document = sqlx::query!(
            r#"
            SELECT file_path, mime_type, user_id
            FROM documents
            WHERE id = $1
            "#,
            item.document_id
        )
        .fetch_optional(&self.pool)
        .await?;

        match document {
            Some(doc) => {
                // Get user's OCR settings
                let settings = if let Some(user_id) = doc.user_id {
                    self.db.get_user_settings(user_id).await.ok().flatten()
                } else {
                    None
                };

                let ocr_language = settings
                    .as_ref()
                    .map(|s| s.ocr_language.clone())
                    .unwrap_or_else(|| "eng".to_string());

                // Perform OCR
                match ocr_service.extract_text_with_lang(&doc.file_path, &doc.mime_type, &ocr_language).await {
                    Ok(text) => {
                        if !text.is_empty() {
                            // Update document with OCR text
                            sqlx::query!(
                                r#"
                                UPDATE documents
                                SET ocr_text = $2,
                                    ocr_status = 'completed',
                                    ocr_completed_at = NOW(),
                                    updated_at = NOW()
                                WHERE id = $1
                                "#,
                                item.document_id,
                                text
                            )
                            .execute(&self.pool)
                            .await?;
                        }

                        let processing_time_ms = start_time.elapsed().as_millis() as i32;
                        self.mark_completed(item.id, processing_time_ms).await?;
                        
                        info!(
                            "Successfully processed OCR job {} for document {} in {}ms",
                            item.id, item.document_id, processing_time_ms
                        );
                    }
                    Err(e) => {
                        let error_msg = format!("OCR extraction failed: {}", e);
                        warn!("{}", error_msg);
                        
                        // Update document status
                        sqlx::query!(
                            r#"
                            UPDATE documents
                            SET ocr_status = 'failed',
                                ocr_error = $2,
                                updated_at = NOW()
                            WHERE id = $1
                            "#,
                            item.document_id,
                            &error_msg
                        )
                        .execute(&self.pool)
                        .await?;
                        
                        self.mark_failed(item.id, &error_msg).await?;
                    }
                }
            }
            None => {
                let error_msg = "Document not found";
                self.mark_failed(item.id, error_msg).await?;
            }
        }

        Ok(())
    }

    /// Start the worker loop
    pub async fn start_worker(self: Arc<Self>) -> Result<()> {
        let semaphore = Arc::new(Semaphore::new(self.max_concurrent_jobs));
        let ocr_service = Arc::new(OcrService::new());
        
        info!(
            "Starting OCR worker {} with {} concurrent jobs",
            self.worker_id, self.max_concurrent_jobs
        );

        loop {
            // Check for items to process
            match self.dequeue().await {
                Ok(Some(item)) => {
                    let permit = semaphore.clone().acquire_owned().await?;
                    let self_clone = self.clone();
                    let ocr_service_clone = ocr_service.clone();
                    
                    // Spawn task to process item
                    tokio::spawn(async move {
                        if let Err(e) = self_clone.process_item(item, &ocr_service_clone).await {
                            error!("Error processing OCR item: {}", e);
                        }
                        drop(permit);
                    });
                }
                Ok(None) => {
                    // No items in queue, sleep briefly
                    sleep(Duration::from_secs(1)).await;
                }
                Err(e) => {
                    error!("Error dequeuing item: {}", e);
                    sleep(Duration::from_secs(5)).await;
                }
            }
        }
    }

    /// Get queue statistics
    pub async fn get_stats(&self) -> Result<QueueStats> {
        let stats = sqlx::query!(
            r#"
            SELECT * FROM get_ocr_queue_stats()
            "#
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(QueueStats {
            pending_count: stats.pending_count.unwrap_or(0),
            processing_count: stats.processing_count.unwrap_or(0),
            failed_count: stats.failed_count.unwrap_or(0),
            completed_today: stats.completed_today.unwrap_or(0),
            avg_wait_time_minutes: stats.avg_wait_time_minutes,
            oldest_pending_minutes: stats.oldest_pending_minutes,
        })
    }

    /// Requeue failed items
    pub async fn requeue_failed_items(&self) -> Result<i64> {
        let result = sqlx::query!(
            r#"
            UPDATE ocr_queue
            SET status = 'pending',
                attempts = 0,
                error_message = NULL,
                started_at = NULL,
                worker_id = NULL
            WHERE status = 'failed'
              AND attempts < max_attempts
            "#
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() as i64)
    }

    /// Clean up old completed items
    pub async fn cleanup_completed(&self, days_to_keep: i32) -> Result<i64> {
        let result = sqlx::query!(
            r#"
            DELETE FROM ocr_queue
            WHERE status = 'completed'
              AND completed_at < NOW() - INTERVAL '1 day' * $1
            "#,
            days_to_keep
        )
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() as i64)
    }

    /// Handle stale processing items (worker crashed)
    pub async fn recover_stale_items(&self, stale_minutes: i32) -> Result<i64> {
        let result = sqlx::query!(
            r#"
            UPDATE ocr_queue
            SET status = 'pending',
                started_at = NULL,
                worker_id = NULL
            WHERE status = 'processing'
              AND started_at < NOW() - INTERVAL '1 minute' * $1
            "#,
            stale_minutes
        )
        .execute(&self.pool)
        .await?;

        if result.rows_affected() > 0 {
            warn!("Recovered {} stale OCR jobs", result.rows_affected());
        }

        Ok(result.rows_affected() as i64)
    }
}
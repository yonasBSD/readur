use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use tracing::{error, info, warn};

use crate::{
    db::Database,
    ocr_queue::OcrQueueService,
    file_service::FileService,
    AppState,
};
use crate::webdav_service::{WebDAVConfig, WebDAVService};

pub struct WebDAVScheduler {
    db: Database,
    state: Arc<AppState>,
    check_interval: Duration,
}

impl WebDAVScheduler {
    pub fn new(state: Arc<AppState>) -> Self {
        Self {
            db: state.db.clone(),
            state,
            check_interval: Duration::from_secs(60), // Check every minute for due syncs
        }
    }

    pub async fn start(&self) {
        info!("Starting WebDAV background sync scheduler");
        
        let mut interval_timer = interval(self.check_interval);
        
        loop {
            interval_timer.tick().await;
            
            if let Err(e) = self.check_and_sync_users().await {
                error!("Error in WebDAV sync scheduler: {}", e);
            }
        }
    }

    async fn check_and_sync_users(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Get all users with WebDAV auto-sync enabled
        let users_with_settings = self.db.get_all_user_settings().await?;
        
        for user_settings in users_with_settings {
            // Skip if WebDAV auto-sync is not enabled
            if !user_settings.webdav_auto_sync || !user_settings.webdav_enabled {
                continue;
            }

            // Check if sync is due for this user
            if self.is_sync_due(&user_settings).await? {
                info!("Starting background WebDAV sync for user {}", user_settings.user_id);
                
                // Get WebDAV configuration
                let webdav_config = self.build_webdav_config(&user_settings)?;
                
                // Create WebDAV service
                match WebDAVService::new(webdav_config.clone()) {
                    Ok(webdav_service) => {
                        // Start sync in background task for this user
                        let state_clone = self.state.clone();
                        let user_id = user_settings.user_id;
                        let enable_background_ocr = user_settings.enable_background_ocr;
                        
                        tokio::spawn(async move {
                            match perform_webdav_sync(state_clone.clone(), user_id, webdav_service, webdav_config, enable_background_ocr).await {
                                Ok(files_processed) => {
                                    info!("Background WebDAV sync completed for user {}: {} files processed", user_id, files_processed);
                                    
                                    // Send success notification if files were processed
                                    if files_processed > 0 {
                                        let notification = crate::models::CreateNotification {
                                            notification_type: "success".to_string(),
                                            title: "WebDAV Sync Completed".to_string(),
                                            message: format!("Successfully processed {} files from WebDAV sync", files_processed),
                                            action_url: Some("/documents".to_string()),
                                            metadata: Some(serde_json::json!({
                                                "sync_type": "webdav",
                                                "files_processed": files_processed
                                            })),
                                        };
                                        
                                        if let Err(e) = state_clone.db.create_notification(user_id, &notification).await {
                                            error!("Failed to create success notification: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    error!("Background WebDAV sync failed for user {}: {}", user_id, e);
                                    
                                    // Send error notification
                                    let notification = crate::models::CreateNotification {
                                        notification_type: "error".to_string(),
                                        title: "WebDAV Sync Failed".to_string(),
                                        message: format!("WebDAV sync encountered an error: {}", e),
                                        action_url: Some("/settings".to_string()),
                                        metadata: Some(serde_json::json!({
                                            "sync_type": "webdav",
                                            "error": e.to_string()
                                        })),
                                    };
                                    
                                    if let Err(e) = state_clone.db.create_notification(user_id, &notification).await {
                                        error!("Failed to create error notification: {}", e);
                                    }
                                }
                            }
                        });
                    }
                    Err(e) => {
                        error!("Failed to create WebDAV service for user {}: {}", user_settings.user_id, e);
                    }
                }
            }
        }

        Ok(())
    }

    async fn is_sync_due(&self, user_settings: &crate::models::Settings) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        // TODO: Add a webdav_sync_state table to track last sync time
        // For now, we'll use a simple time-based check
        
        // Get the sync interval in minutes
        let sync_interval_minutes = user_settings.webdav_sync_interval_minutes;
        
        if sync_interval_minutes <= 0 {
            warn!("Invalid sync interval for user {}: {} minutes", user_settings.user_id, sync_interval_minutes);
            return Ok(false);
        }

        // TODO: Check actual last sync time from database
        // For now, assume sync is always due (this will be refined when we add the webdav_sync_state table)
        Ok(true)
    }

    fn build_webdav_config(&self, settings: &crate::models::Settings) -> Result<WebDAVConfig, Box<dyn std::error::Error + Send + Sync>> {
        let server_url = settings.webdav_server_url.as_ref()
            .ok_or("WebDAV server URL not configured")?
            .clone();
        let username = settings.webdav_username.as_ref()
            .ok_or("WebDAV username not configured")?
            .clone();
        let password = settings.webdav_password.as_ref()
            .unwrap_or(&String::new())
            .clone();

        if server_url.is_empty() || username.is_empty() {
            return Err("WebDAV configuration incomplete".into());
        }

        Ok(WebDAVConfig {
            server_url,
            username,
            password,
            watch_folders: settings.webdav_watch_folders.clone(),
            file_extensions: settings.webdav_file_extensions.clone(),
            timeout_seconds: 30,
            server_type: Some("nextcloud".to_string()),
        })
    }
}

// Re-use the sync function from webdav routes
async fn perform_webdav_sync(
    state: Arc<AppState>,
    user_id: uuid::Uuid,
    webdav_service: WebDAVService,
    config: WebDAVConfig,
    enable_background_ocr: bool,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    use std::path::Path;
    
    info!("Performing background WebDAV sync for user {} on {} folders", user_id, config.watch_folders.len());
    
    let mut files_processed = 0;
    
    // Process each watch folder
    for folder_path in &config.watch_folders {
        info!("Syncing folder: {}", folder_path);
        
        // Discover files in the folder
        match webdav_service.discover_files_in_folder(folder_path).await {
            Ok(files) => {
                info!("Found {} files in folder {}", files.len(), folder_path);
                
                for file_info in files {
                    if file_info.is_directory {
                        continue; // Skip directories
                    }
                    
                    // Check if file extension is supported
                    let file_extension = Path::new(&file_info.name)
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    
                    if !config.file_extensions.contains(&file_extension) {
                        continue; // Skip unsupported file types
                    }
                    
                    // TODO: Check if we've already processed this file using ETag
                    
                    // Download the file
                    match webdav_service.download_file(&file_info.path).await {
                        Ok(file_data) => {
                            info!("Downloaded file: {} ({} bytes)", file_info.name, file_data.len());
                            
                            // Create file service and save file
                            let file_service = FileService::new(state.config.upload_path.clone());
                            
                            let saved_file_path = match file_service.save_file(&file_info.name, &file_data).await {
                                Ok(path) => path,
                                Err(e) => {
                                    error!("Failed to save file {}: {}", file_info.name, e);
                                    continue;
                                }
                            };
                            
                            // Create document record
                            let document = file_service.create_document(
                                &file_info.name,
                                &file_info.name,
                                &saved_file_path,
                                file_info.size,
                                &file_info.mime_type,
                                user_id,
                            );
                            
                            // Save document to database
                            match state.db.create_document(document).await {
                                Ok(saved_document) => {
                                    info!("Created document record: {} (ID: {})", file_info.name, saved_document.id);
                                    
                                    // Add to OCR queue if enabled
                                    if enable_background_ocr {
                                        match sqlx::PgPool::connect(&state.config.database_url).await {
                                            Ok(pool) => {
                                                let queue_service = OcrQueueService::new(state.db.clone(), pool, 1);
                                                
                                                // Calculate priority based on file size
                                                let priority = match file_info.size {
                                                    0..=1048576 => 10,          // <= 1MB: highest priority
                                                    ..=5242880 => 8,            // 1-5MB: high priority
                                                    ..=10485760 => 6,           // 5-10MB: medium priority  
                                                    ..=52428800 => 4,           // 10-50MB: low priority
                                                    _ => 2,                     // > 50MB: lowest priority
                                                };
                                                
                                                if let Err(e) = queue_service.enqueue_document(saved_document.id, priority, file_info.size).await {
                                                    error!("Failed to enqueue document for OCR: {}", e);
                                                } else {
                                                    info!("Enqueued document {} for OCR processing", saved_document.id);
                                                }
                                            }
                                            Err(e) => {
                                                error!("Failed to connect to database for OCR queueing: {}", e);
                                            }
                                        }
                                    }
                                    
                                    files_processed += 1;
                                }
                                Err(e) => {
                                    error!("Failed to create document record for {}: {}", file_info.name, e);
                                }
                            }
                        }
                        Err(e) => {
                            error!("Failed to download file {}: {}", file_info.path, e);
                        }
                    }
                }
            }
            Err(e) => {
                error!("Failed to discover files in folder {}: {}", folder_path, e);
            }
        }
    }
    
    info!("Background WebDAV sync completed for user {}: {} files processed", user_id, files_processed);
    Ok(files_processed)
}
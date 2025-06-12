use anyhow::Result;
use chrono::Utc;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::models::{CreateUser, Document, SearchRequest, SearchMode, SearchSnippet, HighlightRange, EnhancedDocumentResponse, User};

#[derive(Clone)]
pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = PgPool::connect(database_url).await?;
        Ok(Self { pool })
    }

    pub async fn migrate(&self) -> Result<()> {
        // Create extensions
        sqlx::query(r#"CREATE EXTENSION IF NOT EXISTS "uuid-ossp""#)
            .execute(&self.pool)
            .await?;
        
        sqlx::query(r#"CREATE EXTENSION IF NOT EXISTS "pg_trgm""#)
            .execute(&self.pool)
            .await?;
        
        // Create users table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username VARCHAR(255) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            "#,
        )
        .execute(&self.pool)
        .await?;
        
        // Create documents table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                filename VARCHAR(255) NOT NULL,
                original_filename VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size BIGINT NOT NULL,
                mime_type VARCHAR(100) NOT NULL,
                content TEXT,
                ocr_text TEXT,
                tags TEXT[] DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE
            )
            "#,
        )
        .execute(&self.pool)
        .await?;
        
        // Create indexes
        sqlx::query(r#"CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)"#)
            .execute(&self.pool)
            .await?;
        
        sqlx::query(r#"CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename)"#)
            .execute(&self.pool)
            .await?;
        
        sqlx::query(r#"CREATE INDEX IF NOT EXISTS idx_documents_mime_type ON documents(mime_type)"#)
            .execute(&self.pool)
            .await?;
        
        sqlx::query(r#"CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING GIN(tags)"#)
            .execute(&self.pool)
            .await?;
        
        sqlx::query(r#"CREATE INDEX IF NOT EXISTS idx_documents_content_search ON documents USING GIN(to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(ocr_text, '')))"#)
            .execute(&self.pool)
            .await?;
        
        // Create settings table
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS settings (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
                ocr_language VARCHAR(10) DEFAULT 'eng',
                concurrent_ocr_jobs INT DEFAULT 4,
                ocr_timeout_seconds INT DEFAULT 300,
                max_file_size_mb INT DEFAULT 50,
                allowed_file_types TEXT[] DEFAULT ARRAY['pdf', 'png', 'jpg', 'jpeg', 'tiff', 'bmp', 'txt'],
                auto_rotate_images BOOLEAN DEFAULT TRUE,
                enable_image_preprocessing BOOLEAN DEFAULT TRUE,
                search_results_per_page INT DEFAULT 25,
                search_snippet_length INT DEFAULT 200,
                fuzzy_search_threshold REAL DEFAULT 0.8,
                retention_days INT,
                enable_auto_cleanup BOOLEAN DEFAULT FALSE,
                enable_compression BOOLEAN DEFAULT FALSE,
                memory_limit_mb INT DEFAULT 512,
                cpu_priority VARCHAR(10) DEFAULT 'normal',
                enable_background_ocr BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
            "#,
        )
        .execute(&self.pool)
        .await?;
        
        // Run OCR queue migration
        let migration_sql = include_str!("../migrations/001_add_ocr_queue.sql");
        sqlx::query(migration_sql)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn create_user(&self, user: CreateUser) -> Result<User> {
        let password_hash = bcrypt::hash(&user.password, 12)?;
        let now = Utc::now();

        let row = sqlx::query(
            r#"
            INSERT INTO users (username, email, password_hash, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, username, email, password_hash, created_at, updated_at
            "#
        )
        .bind(&user.username)
        .bind(&user.email)
        .bind(&password_hash)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(User {
            id: row.get("id"),
            username: row.get("username"),
            email: row.get("email"),
            password_hash: row.get("password_hash"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    pub async fn get_user_by_username(&self, username: &str) -> Result<Option<User>> {
        let row = sqlx::query(
            "SELECT id, username, email, password_hash, created_at, updated_at FROM users WHERE username = $1"
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(User {
                id: row.get("id"),
                username: row.get("username"),
                email: row.get("email"),
                password_hash: row.get("password_hash"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })),
            None => Ok(None),
        }
    }

    pub async fn get_user_by_id(&self, id: Uuid) -> Result<Option<User>> {
        let row = sqlx::query(
            "SELECT id, username, email, password_hash, created_at, updated_at FROM users WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(User {
                id: row.get("id"),
                username: row.get("username"),
                email: row.get("email"),
                password_hash: row.get("password_hash"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })),
            None => Ok(None),
        }
    }

    pub async fn create_document(&self, document: Document) -> Result<Document> {
        let row = sqlx::query(
            r#"
            INSERT INTO documents (id, filename, original_filename, file_path, file_size, mime_type, content, ocr_text, tags, created_at, updated_at, user_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, filename, original_filename, file_path, file_size, mime_type, content, ocr_text, tags, created_at, updated_at, user_id
            "#
        )
        .bind(document.id)
        .bind(&document.filename)
        .bind(&document.original_filename)
        .bind(&document.file_path)
        .bind(document.file_size)
        .bind(&document.mime_type)
        .bind(&document.content)
        .bind(&document.ocr_text)
        .bind(&document.tags)
        .bind(document.created_at)
        .bind(document.updated_at)
        .bind(document.user_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(Document {
            id: row.get("id"),
            filename: row.get("filename"),
            original_filename: row.get("original_filename"),
            file_path: row.get("file_path"),
            file_size: row.get("file_size"),
            mime_type: row.get("mime_type"),
            content: row.get("content"),
            ocr_text: row.get("ocr_text"),
            tags: row.get("tags"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            user_id: row.get("user_id"),
        })
    }

    pub async fn get_documents_by_user(&self, user_id: Uuid, limit: i64, offset: i64) -> Result<Vec<Document>> {
        let rows = sqlx::query(
            r#"
            SELECT id, filename, original_filename, file_path, file_size, mime_type, content, ocr_text, tags, created_at, updated_at, user_id
            FROM documents 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT $2 OFFSET $3
            "#
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        let documents = rows
            .into_iter()
            .map(|row| Document {
                id: row.get("id"),
                filename: row.get("filename"),
                original_filename: row.get("original_filename"),
                file_path: row.get("file_path"),
                file_size: row.get("file_size"),
                mime_type: row.get("mime_type"),
                content: row.get("content"),
                ocr_text: row.get("ocr_text"),
                tags: row.get("tags"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                user_id: row.get("user_id"),
            })
            .collect();

        Ok(documents)
    }

    pub async fn search_documents(&self, user_id: Uuid, search: SearchRequest) -> Result<(Vec<Document>, i64)> {
        let mut query_builder = sqlx::QueryBuilder::new(
            r#"
            SELECT id, filename, original_filename, file_path, file_size, mime_type, content, ocr_text, tags, created_at, updated_at, user_id,
                   ts_rank(to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(ocr_text, '')), plainto_tsquery('english', "# 
        );
        
        query_builder.push_bind(&search.query);
        query_builder.push(")) as rank FROM documents WHERE user_id = ");
        query_builder.push_bind(user_id);
        query_builder.push(" AND to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(ocr_text, '')) @@ plainto_tsquery('english', ");
        query_builder.push_bind(&search.query);
        query_builder.push(")");

        if let Some(tags) = &search.tags {
            if !tags.is_empty() {
                query_builder.push(" AND tags && ");
                query_builder.push_bind(tags);
            }
        }

        if let Some(mime_types) = &search.mime_types {
            if !mime_types.is_empty() {
                query_builder.push(" AND mime_type = ANY(");
                query_builder.push_bind(mime_types);
                query_builder.push(")");
            }
        }

        query_builder.push(" ORDER BY rank DESC, created_at DESC");
        
        if let Some(limit) = search.limit {
            query_builder.push(" LIMIT ");
            query_builder.push_bind(limit);
        }
        
        if let Some(offset) = search.offset {
            query_builder.push(" OFFSET ");
            query_builder.push_bind(offset);
        }

        let rows = query_builder.build().fetch_all(&self.pool).await?;

        let documents = rows
            .into_iter()
            .map(|row| Document {
                id: row.get("id"),
                filename: row.get("filename"),
                original_filename: row.get("original_filename"),
                file_path: row.get("file_path"),
                file_size: row.get("file_size"),
                mime_type: row.get("mime_type"),
                content: row.get("content"),
                ocr_text: row.get("ocr_text"),
                tags: row.get("tags"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
                user_id: row.get("user_id"),
            })
            .collect();

        let total_row = sqlx::query(
            r#"
            SELECT COUNT(*) as total FROM documents 
            WHERE user_id = $1 
            AND to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(ocr_text, '')) @@ plainto_tsquery('english', $2)
            "#
        )
        .bind(user_id)
        .bind(&search.query)
        .fetch_one(&self.pool)
        .await?;

        let total: i64 = total_row.get("total");

        Ok((documents, total))
    }

    pub async fn enhanced_search_documents(&self, user_id: Uuid, search: SearchRequest) -> Result<(Vec<EnhancedDocumentResponse>, i64, u64)> {
        let start_time = std::time::Instant::now();
        
        // Build search query based on search mode
        let search_mode = search.search_mode.as_ref().unwrap_or(&SearchMode::Simple);
        let query_function = match search_mode {
            SearchMode::Simple => "plainto_tsquery",
            SearchMode::Phrase => "phraseto_tsquery", 
            SearchMode::Fuzzy => "plainto_tsquery", // Could be enhanced with similarity
            SearchMode::Boolean => "to_tsquery",
        };

        let mut query_builder = sqlx::QueryBuilder::new(&format!(
            r#"
            SELECT id, filename, original_filename, file_path, file_size, mime_type, content, ocr_text, tags, created_at, updated_at, user_id,
                   ts_rank(to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(ocr_text, '')), {}('english', "#,
            query_function
        ));
        
        query_builder.push_bind(&search.query);
        query_builder.push(&format!(")) as rank FROM documents WHERE user_id = "));
        query_builder.push_bind(user_id);
        query_builder.push(&format!(" AND to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(ocr_text, '')) @@ {}('english', ", query_function));
        query_builder.push_bind(&search.query);
        query_builder.push(")");

        if let Some(tags) = &search.tags {
            if !tags.is_empty() {
                query_builder.push(" AND tags && ");
                query_builder.push_bind(tags);
            }
        }

        if let Some(mime_types) = &search.mime_types {
            if !mime_types.is_empty() {
                query_builder.push(" AND mime_type = ANY(");
                query_builder.push_bind(mime_types);
                query_builder.push(")");
            }
        }

        query_builder.push(" ORDER BY rank DESC, created_at DESC");
        
        if let Some(limit) = search.limit {
            query_builder.push(" LIMIT ");
            query_builder.push_bind(limit);
        }
        
        if let Some(offset) = search.offset {
            query_builder.push(" OFFSET ");
            query_builder.push_bind(offset);
        }

        let rows = query_builder.build().fetch_all(&self.pool).await?;

        let include_snippets = search.include_snippets.unwrap_or(true);
        let snippet_length = search.snippet_length.unwrap_or(200);

        let mut documents = Vec::new();
        for row in rows {
            let doc_id: Uuid = row.get("id");
            let content: Option<String> = row.get("content");
            let ocr_text: Option<String> = row.get("ocr_text");
            let rank: f32 = row.get("rank");

            let snippets = if include_snippets {
                self.generate_snippets(&search.query, content.as_deref(), ocr_text.as_deref(), snippet_length)
            } else {
                Vec::new()
            };

            documents.push(EnhancedDocumentResponse {
                id: doc_id,
                filename: row.get("filename"),
                original_filename: row.get("original_filename"),
                file_size: row.get("file_size"),
                mime_type: row.get("mime_type"),
                tags: row.get("tags"),
                created_at: row.get("created_at"),
                has_ocr_text: ocr_text.is_some(),
                search_rank: Some(rank),
                snippets,
            });
        }

        let total_row = sqlx::query(&format!(
            r#"
            SELECT COUNT(*) as total FROM documents 
            WHERE user_id = $1 
            AND to_tsvector('english', COALESCE(content, '') || ' ' || COALESCE(ocr_text, '')) @@ {}('english', $2)
            "#, query_function
        ))
        .bind(user_id)
        .bind(&search.query)
        .fetch_one(&self.pool)
        .await?;

        let total: i64 = total_row.get("total");
        let query_time = start_time.elapsed().as_millis() as u64;

        Ok((documents, total, query_time))
    }

    fn generate_snippets(&self, query: &str, content: Option<&str>, ocr_text: Option<&str>, snippet_length: i32) -> Vec<SearchSnippet> {
        let mut snippets = Vec::new();
        
        // Combine content and OCR text
        let full_text = match (content, ocr_text) {
            (Some(c), Some(o)) => format!("{} {}", c, o),
            (Some(c), None) => c.to_string(),
            (None, Some(o)) => o.to_string(),
            (None, None) => return snippets,
        };

        // Simple keyword matching for snippets (could be enhanced with better search algorithms)
        let _query_terms: Vec<&str> = query.split_whitespace().collect();
        let text_lower = full_text.to_lowercase();
        let query_lower = query.to_lowercase();

        // Find matches
        for (i, _) in text_lower.match_indices(&query_lower) {
            let snippet_start = if i >= snippet_length as usize / 2 {
                i - snippet_length as usize / 2
            } else {
                0
            };
            
            let snippet_end = std::cmp::min(
                snippet_start + snippet_length as usize,
                full_text.len()
            );

            if snippet_start < full_text.len() {
                let snippet_text = &full_text[snippet_start..snippet_end];
                
                // Find highlight ranges within this snippet
                let mut highlight_ranges = Vec::new();
                let snippet_lower = snippet_text.to_lowercase();
                
                for (match_start, _) in snippet_lower.match_indices(&query_lower) {
                    highlight_ranges.push(HighlightRange {
                        start: match_start as i32,
                        end: (match_start + query.len()) as i32,
                    });
                }

                snippets.push(SearchSnippet {
                    text: snippet_text.to_string(),
                    start_offset: snippet_start as i32,
                    end_offset: snippet_end as i32,
                    highlight_ranges,
                });

                // Limit to a few snippets per document
                if snippets.len() >= 3 {
                    break;
                }
            }
        }

        snippets
    }

    pub async fn update_document_ocr(&self, id: Uuid, ocr_text: &str) -> Result<()> {
        sqlx::query("UPDATE documents SET ocr_text = $1, updated_at = NOW() WHERE id = $2")
            .bind(ocr_text)
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn get_all_users(&self) -> Result<Vec<User>> {
        let rows = sqlx::query(
            "SELECT id, username, email, password_hash, created_at, updated_at FROM users ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await?;

        let users = rows
            .into_iter()
            .map(|row| User {
                id: row.get("id"),
                username: row.get("username"),
                email: row.get("email"),
                password_hash: row.get("password_hash"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();

        Ok(users)
    }

    pub async fn update_user(&self, id: Uuid, username: Option<String>, email: Option<String>, password: Option<String>) -> Result<User> {
        let user = self.get_user_by_id(id).await?.ok_or_else(|| anyhow::anyhow!("User not found"))?;
        
        let username = username.unwrap_or(user.username);
        let email = email.unwrap_or(user.email);
        let password_hash = if let Some(pwd) = password {
            bcrypt::hash(&pwd, 12)?
        } else {
            user.password_hash
        };

        let row = sqlx::query(
            r#"
            UPDATE users SET username = $1, email = $2, password_hash = $3, updated_at = NOW()
            WHERE id = $4
            RETURNING id, username, email, password_hash, created_at, updated_at
            "#
        )
        .bind(&username)
        .bind(&email)
        .bind(&password_hash)
        .bind(id)
        .fetch_one(&self.pool)
        .await?;

        Ok(User {
            id: row.get("id"),
            username: row.get("username"),
            email: row.get("email"),
            password_hash: row.get("password_hash"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    pub async fn delete_user(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM users WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn get_user_settings(&self, user_id: Uuid) -> Result<Option<crate::models::Settings>> {
        let row = sqlx::query(
            r#"SELECT id, user_id, ocr_language, concurrent_ocr_jobs, ocr_timeout_seconds,
               max_file_size_mb, allowed_file_types, auto_rotate_images, enable_image_preprocessing,
               search_results_per_page, search_snippet_length, fuzzy_search_threshold,
               retention_days, enable_auto_cleanup, enable_compression, memory_limit_mb,
               cpu_priority, enable_background_ocr, created_at, updated_at
               FROM settings WHERE user_id = $1"#
        )
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(crate::models::Settings {
                id: row.get("id"),
                user_id: row.get("user_id"),
                ocr_language: row.get("ocr_language"),
                concurrent_ocr_jobs: row.get("concurrent_ocr_jobs"),
                ocr_timeout_seconds: row.get("ocr_timeout_seconds"),
                max_file_size_mb: row.get("max_file_size_mb"),
                allowed_file_types: row.get("allowed_file_types"),
                auto_rotate_images: row.get("auto_rotate_images"),
                enable_image_preprocessing: row.get("enable_image_preprocessing"),
                search_results_per_page: row.get("search_results_per_page"),
                search_snippet_length: row.get("search_snippet_length"),
                fuzzy_search_threshold: row.get("fuzzy_search_threshold"),
                retention_days: row.get("retention_days"),
                enable_auto_cleanup: row.get("enable_auto_cleanup"),
                enable_compression: row.get("enable_compression"),
                memory_limit_mb: row.get("memory_limit_mb"),
                cpu_priority: row.get("cpu_priority"),
                enable_background_ocr: row.get("enable_background_ocr"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })),
            None => Ok(None),
        }
    }

    pub async fn create_or_update_settings(&self, user_id: Uuid, settings: &crate::models::UpdateSettings) -> Result<crate::models::Settings> {
        // Get existing settings to merge with updates
        let existing = self.get_user_settings(user_id).await?;
        let defaults = crate::models::Settings::default();
        
        // Merge existing/defaults with updates
        let current = existing.unwrap_or_else(|| {
            let mut s = defaults;
            s.user_id = user_id;
            s
        });
        
        let row = sqlx::query(
            r#"
            INSERT INTO settings (
                user_id, ocr_language, concurrent_ocr_jobs, ocr_timeout_seconds,
                max_file_size_mb, allowed_file_types, auto_rotate_images, enable_image_preprocessing,
                search_results_per_page, search_snippet_length, fuzzy_search_threshold,
                retention_days, enable_auto_cleanup, enable_compression, memory_limit_mb,
                cpu_priority, enable_background_ocr
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (user_id) DO UPDATE SET
                ocr_language = $2,
                concurrent_ocr_jobs = $3,
                ocr_timeout_seconds = $4,
                max_file_size_mb = $5,
                allowed_file_types = $6,
                auto_rotate_images = $7,
                enable_image_preprocessing = $8,
                search_results_per_page = $9,
                search_snippet_length = $10,
                fuzzy_search_threshold = $11,
                retention_days = $12,
                enable_auto_cleanup = $13,
                enable_compression = $14,
                memory_limit_mb = $15,
                cpu_priority = $16,
                enable_background_ocr = $17,
                updated_at = NOW()
            RETURNING id, user_id, ocr_language, concurrent_ocr_jobs, ocr_timeout_seconds,
                      max_file_size_mb, allowed_file_types, auto_rotate_images, enable_image_preprocessing,
                      search_results_per_page, search_snippet_length, fuzzy_search_threshold,
                      retention_days, enable_auto_cleanup, enable_compression, memory_limit_mb,
                      cpu_priority, enable_background_ocr, created_at, updated_at
            "#
        )
        .bind(user_id)
        .bind(settings.ocr_language.as_ref().unwrap_or(&current.ocr_language))
        .bind(settings.concurrent_ocr_jobs.unwrap_or(current.concurrent_ocr_jobs))
        .bind(settings.ocr_timeout_seconds.unwrap_or(current.ocr_timeout_seconds))
        .bind(settings.max_file_size_mb.unwrap_or(current.max_file_size_mb))
        .bind(settings.allowed_file_types.as_ref().unwrap_or(&current.allowed_file_types))
        .bind(settings.auto_rotate_images.unwrap_or(current.auto_rotate_images))
        .bind(settings.enable_image_preprocessing.unwrap_or(current.enable_image_preprocessing))
        .bind(settings.search_results_per_page.unwrap_or(current.search_results_per_page))
        .bind(settings.search_snippet_length.unwrap_or(current.search_snippet_length))
        .bind(settings.fuzzy_search_threshold.unwrap_or(current.fuzzy_search_threshold))
        .bind(settings.retention_days.unwrap_or(current.retention_days))
        .bind(settings.enable_auto_cleanup.unwrap_or(current.enable_auto_cleanup))
        .bind(settings.enable_compression.unwrap_or(current.enable_compression))
        .bind(settings.memory_limit_mb.unwrap_or(current.memory_limit_mb))
        .bind(settings.cpu_priority.as_ref().unwrap_or(&current.cpu_priority))
        .bind(settings.enable_background_ocr.unwrap_or(current.enable_background_ocr))
        .fetch_one(&self.pool)
        .await?;

        Ok(crate::models::Settings {
            id: row.get("id"),
            user_id: row.get("user_id"),
            ocr_language: row.get("ocr_language"),
            concurrent_ocr_jobs: row.get("concurrent_ocr_jobs"),
            ocr_timeout_seconds: row.get("ocr_timeout_seconds"),
            max_file_size_mb: row.get("max_file_size_mb"),
            allowed_file_types: row.get("allowed_file_types"),
            auto_rotate_images: row.get("auto_rotate_images"),
            enable_image_preprocessing: row.get("enable_image_preprocessing"),
            search_results_per_page: row.get("search_results_per_page"),
            search_snippet_length: row.get("search_snippet_length"),
            fuzzy_search_threshold: row.get("fuzzy_search_threshold"),
            retention_days: row.get("retention_days"),
            enable_auto_cleanup: row.get("enable_auto_cleanup"),
            enable_compression: row.get("enable_compression"),
            memory_limit_mb: row.get("memory_limit_mb"),
            cpu_priority: row.get("cpu_priority"),
            enable_background_ocr: row.get("enable_background_ocr"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }
}
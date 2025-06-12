use anyhow::Result;
use chrono::Utc;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::models::{CreateUser, Document, SearchRequest, User};

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

    pub async fn update_document_ocr(&self, id: Uuid, ocr_text: &str) -> Result<()> {
        sqlx::query("UPDATE documents SET ocr_text = $1, updated_at = NOW() WHERE id = $2")
            .bind(ocr_text)
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}
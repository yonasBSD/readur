use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateUser {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Document {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_path: String,
    pub file_size: i64,
    pub mime_type: String,
    pub content: Option<String>,
    pub ocr_text: Option<String>,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocumentResponse {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub has_ocr_text: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchRequest {
    pub query: String,
    pub tags: Option<Vec<String>>,
    pub mime_types: Option<Vec<String>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub documents: Vec<DocumentResponse>,
    pub total: i64,
}

impl From<Document> for DocumentResponse {
    fn from(doc: Document) -> Self {
        Self {
            id: doc.id,
            filename: doc.filename,
            original_filename: doc.original_filename,
            file_size: doc.file_size,
            mime_type: doc.mime_type,
            tags: doc.tags,
            created_at: doc.created_at,
            has_ocr_text: doc.ocr_text.is_some(),
        }
    }
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            username: user.username,
            email: user.email,
        }
    }
}
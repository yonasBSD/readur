use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use utoipa::{ToSchema, IntoParams};

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateUser {
    pub username: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
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
    pub ocr_confidence: Option<f32>,
    pub ocr_word_count: Option<i32>,
    pub ocr_processing_time_ms: Option<i32>,
    pub ocr_status: Option<String>,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DocumentResponse {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub has_ocr_text: bool,
    pub ocr_confidence: Option<f32>,
    pub ocr_word_count: Option<i32>,
    pub ocr_processing_time_ms: Option<i32>,
    pub ocr_status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema, IntoParams)]
pub struct SearchRequest {
    pub query: String,
    pub tags: Option<Vec<String>>,
    pub mime_types: Option<Vec<String>>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub include_snippets: Option<bool>,
    pub snippet_length: Option<i32>,
    pub search_mode: Option<SearchMode>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub enum SearchMode {
    #[serde(rename = "simple")]
    Simple,
    #[serde(rename = "phrase")]
    Phrase,
    #[serde(rename = "fuzzy")]
    Fuzzy,
    #[serde(rename = "boolean")]
    Boolean,
}

impl Default for SearchMode {
    fn default() -> Self {
        SearchMode::Simple
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SearchSnippet {
    pub text: String,
    pub start_offset: i32,
    pub end_offset: i32,
    pub highlight_ranges: Vec<HighlightRange>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct HighlightRange {
    pub start: i32,
    pub end: i32,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct EnhancedDocumentResponse {
    pub id: Uuid,
    pub filename: String,
    pub original_filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub has_ocr_text: bool,
    pub ocr_confidence: Option<f32>,
    pub ocr_word_count: Option<i32>,
    pub ocr_processing_time_ms: Option<i32>,
    pub ocr_status: Option<String>,
    pub search_rank: Option<f32>,
    pub snippets: Vec<SearchSnippet>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SearchResponse {
    pub documents: Vec<EnhancedDocumentResponse>,
    pub total: i64,
    pub query_time_ms: u64,
    pub suggestions: Vec<String>,
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
            ocr_confidence: doc.ocr_confidence,
            ocr_word_count: doc.ocr_word_count,
            ocr_processing_time_ms: doc.ocr_processing_time_ms,
            ocr_status: doc.ocr_status,
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

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateUser {
    pub username: Option<String>,
    pub email: Option<String>,
    pub password: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, FromRow, ToSchema)]
pub struct Settings {
    pub id: Uuid,
    pub user_id: Uuid,
    pub ocr_language: String,
    pub concurrent_ocr_jobs: i32,
    pub ocr_timeout_seconds: i32,
    pub max_file_size_mb: i32,
    pub allowed_file_types: Vec<String>,
    pub auto_rotate_images: bool,
    pub enable_image_preprocessing: bool,
    pub search_results_per_page: i32,
    pub search_snippet_length: i32,
    pub fuzzy_search_threshold: f32,
    pub retention_days: Option<i32>,
    pub enable_auto_cleanup: bool,
    pub enable_compression: bool,
    pub memory_limit_mb: i32,
    pub cpu_priority: String,
    pub enable_background_ocr: bool,
    pub ocr_page_segmentation_mode: i32,
    pub ocr_engine_mode: i32,
    pub ocr_min_confidence: f32,
    pub ocr_dpi: i32,
    pub ocr_enhance_contrast: bool,
    pub ocr_remove_noise: bool,
    pub ocr_detect_orientation: bool,
    pub ocr_whitelist_chars: Option<String>,
    pub ocr_blacklist_chars: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SettingsResponse {
    pub ocr_language: String,
    pub concurrent_ocr_jobs: i32,
    pub ocr_timeout_seconds: i32,
    pub max_file_size_mb: i32,
    pub allowed_file_types: Vec<String>,
    pub auto_rotate_images: bool,
    pub enable_image_preprocessing: bool,
    pub search_results_per_page: i32,
    pub search_snippet_length: i32,
    pub fuzzy_search_threshold: f32,
    pub retention_days: Option<i32>,
    pub enable_auto_cleanup: bool,
    pub enable_compression: bool,
    pub memory_limit_mb: i32,
    pub cpu_priority: String,
    pub enable_background_ocr: bool,
    pub ocr_page_segmentation_mode: i32,
    pub ocr_engine_mode: i32,
    pub ocr_min_confidence: f32,
    pub ocr_dpi: i32,
    pub ocr_enhance_contrast: bool,
    pub ocr_remove_noise: bool,
    pub ocr_detect_orientation: bool,
    pub ocr_whitelist_chars: Option<String>,
    pub ocr_blacklist_chars: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateSettings {
    pub ocr_language: Option<String>,
    pub concurrent_ocr_jobs: Option<i32>,
    pub ocr_timeout_seconds: Option<i32>,
    pub max_file_size_mb: Option<i32>,
    pub allowed_file_types: Option<Vec<String>>,
    pub auto_rotate_images: Option<bool>,
    pub enable_image_preprocessing: Option<bool>,
    pub search_results_per_page: Option<i32>,
    pub search_snippet_length: Option<i32>,
    pub fuzzy_search_threshold: Option<f32>,
    pub retention_days: Option<Option<i32>>,
    pub enable_auto_cleanup: Option<bool>,
    pub enable_compression: Option<bool>,
    pub memory_limit_mb: Option<i32>,
    pub cpu_priority: Option<String>,
    pub enable_background_ocr: Option<bool>,
    pub ocr_page_segmentation_mode: Option<i32>,
    pub ocr_engine_mode: Option<i32>,
    pub ocr_min_confidence: Option<f32>,
    pub ocr_dpi: Option<i32>,
    pub ocr_enhance_contrast: Option<bool>,
    pub ocr_remove_noise: Option<bool>,
    pub ocr_detect_orientation: Option<bool>,
    pub ocr_whitelist_chars: Option<Option<String>>,
    pub ocr_blacklist_chars: Option<Option<String>>,
}

impl From<Settings> for SettingsResponse {
    fn from(settings: Settings) -> Self {
        Self {
            ocr_language: settings.ocr_language,
            concurrent_ocr_jobs: settings.concurrent_ocr_jobs,
            ocr_timeout_seconds: settings.ocr_timeout_seconds,
            max_file_size_mb: settings.max_file_size_mb,
            allowed_file_types: settings.allowed_file_types,
            auto_rotate_images: settings.auto_rotate_images,
            enable_image_preprocessing: settings.enable_image_preprocessing,
            search_results_per_page: settings.search_results_per_page,
            search_snippet_length: settings.search_snippet_length,
            fuzzy_search_threshold: settings.fuzzy_search_threshold,
            retention_days: settings.retention_days,
            enable_auto_cleanup: settings.enable_auto_cleanup,
            enable_compression: settings.enable_compression,
            memory_limit_mb: settings.memory_limit_mb,
            cpu_priority: settings.cpu_priority,
            enable_background_ocr: settings.enable_background_ocr,
            ocr_page_segmentation_mode: settings.ocr_page_segmentation_mode,
            ocr_engine_mode: settings.ocr_engine_mode,
            ocr_min_confidence: settings.ocr_min_confidence,
            ocr_dpi: settings.ocr_dpi,
            ocr_enhance_contrast: settings.ocr_enhance_contrast,
            ocr_remove_noise: settings.ocr_remove_noise,
            ocr_detect_orientation: settings.ocr_detect_orientation,
            ocr_whitelist_chars: settings.ocr_whitelist_chars,
            ocr_blacklist_chars: settings.ocr_blacklist_chars,
        }
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            id: Uuid::new_v4(),
            user_id: Uuid::nil(),
            ocr_language: "eng".to_string(),
            concurrent_ocr_jobs: 4,
            ocr_timeout_seconds: 300,
            max_file_size_mb: 50,
            allowed_file_types: vec![
                "pdf".to_string(),
                "png".to_string(),
                "jpg".to_string(),
                "jpeg".to_string(),
                "tiff".to_string(),
                "bmp".to_string(),
                "txt".to_string(),
            ],
            auto_rotate_images: true,
            enable_image_preprocessing: true,
            search_results_per_page: 25,
            search_snippet_length: 200,
            fuzzy_search_threshold: 0.8,
            retention_days: None,
            enable_auto_cleanup: false,
            enable_compression: false,
            memory_limit_mb: 512,
            cpu_priority: "normal".to_string(),
            enable_background_ocr: true,
            ocr_page_segmentation_mode: 3, // PSM_AUTO_OSD - Fully automatic page segmentation, but no OSD
            ocr_engine_mode: 3, // OEM_DEFAULT - Default, based on what is available
            ocr_min_confidence: 30.0, // Minimum confidence threshold (0-100)
            ocr_dpi: 300, // Optimal DPI for OCR
            ocr_enhance_contrast: true, // Enable contrast enhancement
            ocr_remove_noise: true, // Enable noise removal
            ocr_detect_orientation: true, // Enable orientation detection
            ocr_whitelist_chars: None, // No character whitelist by default
            ocr_blacklist_chars: None, // No character blacklist by default
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}
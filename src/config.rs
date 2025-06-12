use anyhow::Result;
use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub server_address: String,
    pub jwt_secret: String,
    pub upload_path: String,
    pub watch_folder: String,
    pub allowed_file_types: Vec<String>,
    pub watch_interval_seconds: Option<u64>,
    pub file_stability_check_ms: Option<u64>,
    pub max_file_age_hours: Option<u64>,
    
    // OCR Configuration
    pub ocr_language: String,
    pub concurrent_ocr_jobs: usize,
    pub ocr_timeout_seconds: u64,
    pub max_file_size_mb: u64,
    
    // Performance
    pub memory_limit_mb: usize,
    pub cpu_priority: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();
        
        Ok(Config {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgresql://readur:readur@localhost/readur".to_string()),
            server_address: env::var("SERVER_ADDRESS")
                .unwrap_or_else(|_| "0.0.0.0:8000".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "your-secret-key".to_string()),
            upload_path: env::var("UPLOAD_PATH")
                .unwrap_or_else(|_| "./uploads".to_string()),
            watch_folder: env::var("WATCH_FOLDER")
                .unwrap_or_else(|_| "./watch".to_string()),
            allowed_file_types: env::var("ALLOWED_FILE_TYPES")
                .unwrap_or_else(|_| "pdf,txt,doc,docx,png,jpg,jpeg".to_string())
                .split(',')
                .map(|s| s.trim().to_lowercase())
                .collect(),
            watch_interval_seconds: env::var("WATCH_INTERVAL_SECONDS")
                .ok()
                .and_then(|s| s.parse().ok()),
            file_stability_check_ms: env::var("FILE_STABILITY_CHECK_MS")
                .ok()
                .and_then(|s| s.parse().ok()),
            max_file_age_hours: env::var("MAX_FILE_AGE_HOURS")
                .ok()
                .and_then(|s| s.parse().ok()),
                
            // OCR Configuration
            ocr_language: env::var("OCR_LANGUAGE")
                .unwrap_or_else(|_| "eng".to_string()),
            concurrent_ocr_jobs: env::var("CONCURRENT_OCR_JOBS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(4),
            ocr_timeout_seconds: env::var("OCR_TIMEOUT_SECONDS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(300),
            max_file_size_mb: env::var("MAX_FILE_SIZE_MB")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(50),
                
            // Performance
            memory_limit_mb: env::var("MEMORY_LIMIT_MB")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(512),
            cpu_priority: env::var("CPU_PRIORITY")
                .unwrap_or_else(|_| "normal".to_string()),
        })
    }
}
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
        })
    }
}
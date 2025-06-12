use anyhow::Result;
use chrono::Utc;
use std::path::Path;
use tokio::fs;
use uuid::Uuid;

use crate::models::Document;

pub struct FileService {
    upload_path: String,
}

impl FileService {
    pub fn new(upload_path: String) -> Self {
        Self { upload_path }
    }

    pub async fn save_file(&self, filename: &str, data: &[u8]) -> Result<String> {
        let file_id = Uuid::new_v4();
        let extension = Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");
        
        let saved_filename = if extension.is_empty() {
            file_id.to_string()
        } else {
            format!("{}.{}", file_id, extension)
        };
        
        let file_path = Path::new(&self.upload_path).join(&saved_filename);
        
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent).await?;
        }
        
        fs::write(&file_path, data).await?;
        
        Ok(file_path.to_string_lossy().to_string())
    }

    pub fn create_document(
        &self,
        filename: &str,
        original_filename: &str,
        file_path: &str,
        file_size: i64,
        mime_type: &str,
        user_id: Uuid,
    ) -> Document {
        Document {
            id: Uuid::new_v4(),
            filename: filename.to_string(),
            original_filename: original_filename.to_string(),
            file_path: file_path.to_string(),
            file_size,
            mime_type: mime_type.to_string(),
            content: None,
            ocr_text: None,
            tags: Vec::new(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            user_id,
        }
    }

    pub fn is_allowed_file_type(&self, filename: &str, allowed_types: &[String]) -> bool {
        if let Some(extension) = Path::new(filename)
            .extension()
            .and_then(|ext| ext.to_str())
        {
            let ext_lower = extension.to_lowercase();
            allowed_types.contains(&ext_lower)
        } else {
            false
        }
    }

    pub async fn read_file(&self, file_path: &str) -> Result<Vec<u8>> {
        let data = fs::read(file_path).await?;
        Ok(data)
    }
}
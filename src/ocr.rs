use anyhow::{anyhow, Result};
use std::path::Path;
use tesseract::Tesseract;

pub struct OcrService;

impl OcrService {
    pub fn new() -> Self {
        Self
    }

    pub async fn extract_text_from_image(&self, file_path: &str) -> Result<String> {
        let mut tesseract = Tesseract::new(None, Some("eng"))?
            .set_image(file_path)?;
        
        let text = tesseract.get_text()?;
        
        Ok(text.trim().to_string())
    }

    pub async fn extract_text_from_pdf(&self, file_path: &str) -> Result<String> {
        let bytes = std::fs::read(file_path)?;
        let text = pdf_extract::extract_text_from_mem(&bytes)
            .map_err(|e| anyhow!("Failed to extract text from PDF: {}", e))?;
        
        Ok(text.trim().to_string())
    }

    pub async fn extract_text(&self, file_path: &str, mime_type: &str) -> Result<String> {
        match mime_type {
            "application/pdf" => self.extract_text_from_pdf(file_path).await,
            "image/png" | "image/jpeg" | "image/jpg" | "image/tiff" | "image/bmp" => {
                self.extract_text_from_image(file_path).await
            }
            "text/plain" => {
                let text = tokio::fs::read_to_string(file_path).await?;
                Ok(text)
            }
            _ => {
                if self.is_image_file(file_path) {
                    self.extract_text_from_image(file_path).await
                } else {
                    Err(anyhow!("Unsupported file type for OCR: {}", mime_type))
                }
            }
        }
    }

    pub fn is_image_file(&self, file_path: &str) -> bool {
        if let Some(extension) = Path::new(file_path)
            .extension()
            .and_then(|ext| ext.to_str())
        {
            let ext_lower = extension.to_lowercase();
            matches!(ext_lower.as_str(), "png" | "jpg" | "jpeg" | "tiff" | "bmp" | "gif")
        } else {
            false
        }
    }
}
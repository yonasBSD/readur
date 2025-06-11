#[cfg(test)]
mod tests {
    use super::super::ocr::OcrService;
    use std::fs;
    use tempfile::NamedTempFile;

    #[test]
    fn test_is_image_file() {
        let ocr_service = OcrService::new();
        
        assert!(ocr_service.is_image_file("image.png"));
        assert!(ocr_service.is_image_file("photo.jpg"));
        assert!(ocr_service.is_image_file("picture.JPEG"));
        assert!(ocr_service.is_image_file("scan.tiff"));
        assert!(ocr_service.is_image_file("bitmap.bmp"));
        assert!(ocr_service.is_image_file("animation.gif"));
        
        assert!(!ocr_service.is_image_file("document.pdf"));
        assert!(!ocr_service.is_image_file("text.txt"));
        assert!(!ocr_service.is_image_file("archive.zip"));
        assert!(!ocr_service.is_image_file("noextension"));
    }

    #[tokio::test]
    async fn test_extract_text_from_plain_text() {
        let ocr_service = OcrService::new();
        
        let mut temp_file = NamedTempFile::new().unwrap();
        let test_content = "This is a test text file.\nWith multiple lines.";
        fs::write(temp_file.path(), test_content).unwrap();
        
        let result = ocr_service
            .extract_text(temp_file.path().to_str().unwrap(), "text/plain")
            .await;
        
        assert!(result.is_ok());
        let extracted_text = result.unwrap();
        assert_eq!(extracted_text, test_content);
    }

    #[tokio::test]
    async fn test_extract_text_unsupported_type() {
        let ocr_service = OcrService::new();
        
        let mut temp_file = NamedTempFile::new().unwrap();
        fs::write(temp_file.path(), "some content").unwrap();
        
        let result = ocr_service
            .extract_text(temp_file.path().to_str().unwrap(), "application/zip")
            .await;
        
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Unsupported file type"));
    }

    #[tokio::test]
    async fn test_extract_text_from_nonexistent_file() {
        let ocr_service = OcrService::new();
        
        let result = ocr_service
            .extract_text("/path/to/nonexistent/file.txt", "text/plain")
            .await;
        
        assert!(result.is_err());
    }

    // Note: These tests would require actual PDF and image files to test fully
    // For now, we're testing the error handling and basic functionality
    
    #[tokio::test]
    async fn test_extract_text_from_pdf_empty_file() {
        let ocr_service = OcrService::new();
        
        let mut temp_file = NamedTempFile::new().unwrap();
        fs::write(temp_file.path(), "").unwrap(); // Empty file, not a valid PDF
        
        let result = ocr_service
            .extract_text_from_pdf(temp_file.path().to_str().unwrap())
            .await;
        
        // Should fail because it's not a valid PDF
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_extract_text_with_image_extension_fallback() {
        let ocr_service = OcrService::new();
        
        let mut temp_file = NamedTempFile::with_suffix(".png").unwrap();
        fs::write(temp_file.path(), "fake image data").unwrap();
        
        let result = ocr_service
            .extract_text(temp_file.path().to_str().unwrap(), "unknown/type")
            .await;
        
        // This should try to process as image due to extension, but fail due to invalid data
        // The important thing is that it attempts image processing
        assert!(result.is_err());
    }
}
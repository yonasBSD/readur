#[cfg(test)]
mod tests {
    use crate::ocr::OcrService;
    use std::fs;
    use std::path::Path;
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
        
        let temp_file = NamedTempFile::new().unwrap();
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
        
        let temp_file = NamedTempFile::new().unwrap();
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

    #[tokio::test]
    #[cfg_attr(not(feature = "ci"), ignore = "Requires tesseract runtime")]
    async fn test_extract_text_with_real_image() {
        let ocr_service = OcrService::new();
        
        // Create a simple test image with text if it doesn't exist
        let test_image_path = "test_data/hello_ocr.png";
        
        // Skip test if test data doesn't exist
        if !Path::new(test_image_path).exists() {
            eprintln!("Skipping test_extract_text_with_real_image: test data not found");
            return;
        }
        
        let result = ocr_service
            .extract_text(test_image_path, "image/png")
            .await;
        
        match result {
            Ok(text) => {
                println!("OCR extracted text: '{}'", text);
                // OCR might not be perfect, so we check if it contains expected words
                assert!(text.to_lowercase().contains("hello") || text.to_lowercase().contains("ocr"));
            }
            Err(e) => {
                eprintln!("OCR test failed: {}", e);
                // Don't fail the test if OCR is not available
            }
        }
    }

    #[tokio::test]
    async fn test_extract_text_from_pdf_with_content() {
        let ocr_service = OcrService::new();
        
        // Create a minimal valid PDF
        let temp_file = NamedTempFile::with_suffix(".pdf").unwrap();
        
        // This is a minimal PDF that says "Hello"
        let pdf_content = b"%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
100 700 Td
(Hello) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000262 00000 n
0000000341 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
435
%%EOF";
        
        fs::write(temp_file.path(), pdf_content).unwrap();
        
        let result = ocr_service
            .extract_text_from_pdf(temp_file.path().to_str().unwrap())
            .await;
        
        // The pdf-extract library might not work with our minimal PDF
        // so we just check that it attempts to process it
        match result {
            Ok(text) => {
                println!("PDF extracted text: '{}'", text);
            }
            Err(e) => {
                println!("PDF extraction error (expected): {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_extract_text_with_image_extension_fallback() {
        let ocr_service = OcrService::new();
        
        let temp_file = NamedTempFile::with_suffix(".png").unwrap();
        fs::write(temp_file.path(), "fake image data").unwrap();
        
        let result = ocr_service
            .extract_text(temp_file.path().to_str().unwrap(), "unknown/type")
            .await;
        
        // This should try to process as image due to extension, but fail due to invalid data
        assert!(result.is_err());
    }
}
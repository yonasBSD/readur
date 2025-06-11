#[cfg(test)]
mod tests {
    use super::super::db::Database;
    use super::super::models::{CreateUser, Document, SearchRequest};
    use chrono::Utc;
    use tempfile::NamedTempFile;
    use uuid::Uuid;

    async fn create_test_db() -> Database {
        let temp_file = NamedTempFile::new().unwrap();
        let db_url = format!("sqlite://{}", temp_file.path().display());
        
        let db = Database::new(&db_url).await.unwrap();
        db.migrate().await.unwrap();
        db
    }

    fn create_test_user_data() -> CreateUser {
        CreateUser {
            username: "testuser".to_string(),
            email: "test@example.com".to_string(),
            password: "password123".to_string(),
        }
    }

    fn create_test_document(user_id: Uuid) -> Document {
        Document {
            id: Uuid::new_v4(),
            filename: "test.pdf".to_string(),
            original_filename: "test.pdf".to_string(),
            file_path: "/path/to/test.pdf".to_string(),
            file_size: 1024,
            mime_type: "application/pdf".to_string(),
            content: Some("Test content".to_string()),
            ocr_text: Some("OCR extracted text".to_string()),
            tags: vec!["test".to_string(), "document".to_string()],
            created_at: Utc::now(),
            updated_at: Utc::now(),
            user_id,
        }
    }

    #[tokio::test]
    async fn test_create_user() {
        let db = create_test_db().await;
        let user_data = create_test_user_data();
        
        let result = db.create_user(user_data).await;
        assert!(result.is_ok());
        
        let user = result.unwrap();
        assert_eq!(user.username, "testuser");
        assert_eq!(user.email, "test@example.com");
        assert!(!user.password_hash.is_empty());
        assert_ne!(user.password_hash, "password123"); // Should be hashed
    }

    #[tokio::test]
    async fn test_get_user_by_username() {
        let db = create_test_db().await;
        let user_data = create_test_user_data();
        
        let created_user = db.create_user(user_data).await.unwrap();
        
        let result = db.get_user_by_username("testuser").await;
        assert!(result.is_ok());
        
        let found_user = result.unwrap();
        assert!(found_user.is_some());
        
        let user = found_user.unwrap();
        assert_eq!(user.id, created_user.id);
        assert_eq!(user.username, "testuser");
    }

    #[tokio::test]
    async fn test_get_user_by_username_not_found() {
        let db = create_test_db().await;
        
        let result = db.get_user_by_username("nonexistent").await;
        assert!(result.is_ok());
        
        let found_user = result.unwrap();
        assert!(found_user.is_none());
    }

    #[tokio::test]
    async fn test_create_document() {
        let db = create_test_db().await;
        let user_data = create_test_user_data();
        let user = db.create_user(user_data).await.unwrap();
        
        let document = create_test_document(user.id);
        
        let result = db.create_document(document.clone()).await;
        assert!(result.is_ok());
        
        let created_doc = result.unwrap();
        assert_eq!(created_doc.filename, document.filename);
        assert_eq!(created_doc.user_id, user.id);
    }

    #[tokio::test]
    async fn test_get_documents_by_user() {
        let db = create_test_db().await;
        let user_data = create_test_user_data();
        let user = db.create_user(user_data).await.unwrap();
        
        let document1 = create_test_document(user.id);
        let document2 = create_test_document(user.id);
        
        db.create_document(document1).await.unwrap();
        db.create_document(document2).await.unwrap();
        
        let result = db.get_documents_by_user(user.id, 10, 0).await;
        assert!(result.is_ok());
        
        let documents = result.unwrap();
        assert_eq!(documents.len(), 2);
    }

    #[tokio::test]
    async fn test_search_documents() {
        let db = create_test_db().await;
        let user_data = create_test_user_data();
        let user = db.create_user(user_data).await.unwrap();
        
        let mut document = create_test_document(user.id);
        document.content = Some("This is a searchable document".to_string());
        document.ocr_text = Some("OCR searchable text".to_string());
        
        db.create_document(document).await.unwrap();
        
        let search_request = SearchRequest {
            query: "searchable".to_string(),
            tags: None,
            mime_types: None,
            limit: Some(10),
            offset: Some(0),
        };
        
        let result = db.search_documents(user.id, search_request).await;
        assert!(result.is_ok());
        
        let (documents, total) = result.unwrap();
        assert_eq!(documents.len(), 1);
        assert_eq!(total, 1);
    }

    #[tokio::test]
    async fn test_update_document_ocr() {
        let db = create_test_db().await;
        let user_data = create_test_user_data();
        let user = db.create_user(user_data).await.unwrap();
        
        let document = create_test_document(user.id);
        let created_doc = db.create_document(document).await.unwrap();
        
        let new_ocr_text = "Updated OCR text";
        let result = db.update_document_ocr(created_doc.id, new_ocr_text).await;
        assert!(result.is_ok());
        
        // Verify the update by searching
        let documents = db.get_documents_by_user(user.id, 10, 0).await.unwrap();
        let updated_doc = documents.iter().find(|d| d.id == created_doc.id).unwrap();
        assert_eq!(updated_doc.ocr_text.as_ref().unwrap(), new_ocr_text);
    }
}
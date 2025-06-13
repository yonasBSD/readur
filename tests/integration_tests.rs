use readur::{AppState, health_check};
use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use serde_json::{json, Value};
use tower::ServiceExt;
use std::sync::Arc;

mod helpers;
use helpers::setup_test_environment;

#[tokio::test]
async fn test_ocr_endpoint_integration() {
    let (app, _container) = setup_test_environment().await;
    
    // This test would require the full stack with database
    // and would test the actual OCR endpoint with real data
    
    // Example test structure:
    // 1. Create a test user and get auth token
    // 2. Upload a test document
    // 3. Wait for OCR processing to complete
    // 4. Call the OCR endpoint
    // 5. Verify the response structure and content
    
    println!("Integration test placeholder - requires full Docker stack");
}

#[tokio::test]
async fn test_health_check_endpoint() {
    let app = Router::new()
        .route("/health", axum::routing::get(health_check));
    
    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    
    assert_eq!(response.status(), StatusCode::OK);
    
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(json["status"], "ok");
}

#[tokio::test] 
async fn test_document_upload_and_ocr_flow() {
    // This would be a comprehensive integration test that:
    // 1. Sets up a test database
    // 2. Uploads a test image/PDF
    // 3. Waits for OCR processing
    // 4. Retrieves OCR text via API
    // 5. Verifies the complete flow
    
    println!("Full OCR integration test - requires Tesseract and database");
}
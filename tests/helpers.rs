use readur::{AppState, config::Config, db::Database};
use axum::Router;
use std::sync::Arc;
use testcontainers::{clients::Cli, RunnableImage, Container};
use testcontainers_modules::postgres::Postgres;

pub async fn setup_test_environment() -> (Router, Container<'static, Postgres>) {
    let docker = Box::leak(Box::new(Cli::default()));
    let postgres_image = RunnableImage::from(Postgres::default())
        .with_env_var(("POSTGRES_USER", "test"))
        .with_env_var(("POSTGRES_PASSWORD", "test"))
        .with_env_var(("POSTGRES_DB", "test"));
    
    let container = docker.run(postgres_image);
    let port = container.get_host_port_ipv4(5432);
    
    let database_url = format!("postgresql://test:test@localhost:{}/test", port);
    let db = Database::new(&database_url).await.unwrap();
    
    // Use SQLx migrations for integration tests
    sqlx::migrate!("./migrations")
        .run(&db.pool)
        .await
        .unwrap();
    
    let config = Config {
        database_url: database_url.clone(),
        server_address: "127.0.0.1:0".to_string(),
        jwt_secret: "test-secret".to_string(),
        upload_path: "./test-uploads".to_string(),
        watch_folder: "./test-watch".to_string(),
        allowed_file_types: vec!["pdf".to_string(), "txt".to_string(), "png".to_string()],
        watch_interval_seconds: Some(30),
        file_stability_check_ms: Some(500),
        max_file_age_hours: None,
        
        // OCR Configuration for testing
        ocr_language: "eng".to_string(),
        concurrent_ocr_jobs: 1, // Single job for tests
        ocr_timeout_seconds: 30, // Shorter for tests
        max_file_size_mb: 5, // Smaller for tests
        
        // Performance
        memory_limit_mb: 128, // Lower for tests
        cpu_priority: "normal".to_string(),
    };
    
    let state = Arc::new(AppState { db, config });
    
    let app = Router::new()
        .route("/api/health", axum::routing::get(readur::health_check))
        .nest("/api/auth", readur::routes::auth::router())
        .nest("/api/documents", readur::routes::documents::router())
        .nest("/api/search", readur::routes::search::router())
        .nest("/api/settings", readur::routes::settings::router())
        .nest("/api/users", readur::routes::users::router())
        .with_state(state);
    
    (app, container)
}

pub async fn create_test_user_and_login(app: &Router) -> String {
    use tower::ServiceExt;
    use serde_json::json;
    
    // Register user
    let user_data = json!({
        "username": "testuser",
        "email": "test@example.com", 
        "password": "password123"
    });
    
    let _register_response = app
        .clone()
        .oneshot(
            axum::http::Request::builder()
                .method("POST")
                .uri("/api/auth/register")
                .header("Content-Type", "application/json")
                .body(axum::body::Body::from(serde_json::to_vec(&user_data).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    
    // Login to get token
    let login_data = json!({
        "username": "testuser",
        "password": "password123"
    });
    
    let login_response = app
        .clone()
        .oneshot(
            axum::http::Request::builder()
                .method("POST")
                .uri("/api/auth/login")
                .header("Content-Type", "application/json")
                .body(axum::body::Body::from(serde_json::to_vec(&login_data).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    
    let body = axum::body::to_bytes(login_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let login_response: serde_json::Value = serde_json::from_slice(&body).unwrap();
    
    login_response["token"].as_str().unwrap().to_string()
}
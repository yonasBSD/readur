use axum::{
    http::StatusCode,
    response::{Json, Html},
    routing::get,
    Router,
};
use std::sync::Arc;
use tower_http::{cors::CorsLayer, services::ServeDir};
use tracing::{info, error};

mod auth;
mod batch_ingest;
mod config;
mod db;
mod file_service;
mod models;
mod ocr;
mod ocr_queue;
mod routes;
mod seed;
mod swagger;
mod watcher;

#[cfg(test)]
mod tests;

use config::Config;
use db::Database;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: Config,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt::init();
    
    let config = Config::from_env()?;
    let db = Database::new(&config.database_url).await?;
    
    db.migrate().await?;
    
    // Seed admin user
    seed::seed_admin_user(&db).await?;
    
    let state = AppState { db, config: config.clone() };
    
    let app = Router::new()
        .route("/api/health", get(readur::health_check))
        .nest("/api/auth", routes::auth::router())
        .nest("/api/documents", routes::documents::router())
        .nest("/api/queue", routes::queue::router())
        .nest("/api/search", routes::search::router())
        .nest("/api/settings", routes::settings::router())
        .nest("/api/users", routes::users::router())
        .merge(swagger::create_swagger_router())
        .nest_service("/", ServeDir::new("/app/frontend"))
        .fallback(serve_spa)
        .layer(CorsLayer::permissive())
        .with_state(Arc::new(state));
    
    let watcher_config = config.clone();
    tokio::spawn(async move {
        if let Err(e) = watcher::start_folder_watcher(watcher_config).await {
            error!("Folder watcher error: {}", e);
        }
    });
    
    // Start OCR queue worker
    let queue_db = Database::new(&config.database_url).await?;
    let queue_pool = sqlx::PgPool::connect(&config.database_url).await?;
    let concurrent_jobs = 4; // TODO: Get from config/settings
    let queue_service = Arc::new(ocr_queue::OcrQueueService::new(queue_db, queue_pool, concurrent_jobs));
    
    let queue_worker = queue_service.clone();
    tokio::spawn(async move {
        if let Err(e) = queue_worker.start_worker().await {
            error!("OCR queue worker error: {}", e);
        }
    });
    
    // Start maintenance tasks
    let queue_maintenance = queue_service.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(300)); // Every 5 minutes
        loop {
            interval.tick().await;
            
            // Recover stale items (older than 10 minutes)
            if let Err(e) = queue_maintenance.recover_stale_items(10).await {
                error!("Error recovering stale items: {}", e);
            }
            
            // Clean up old completed items (older than 7 days)
            if let Err(e) = queue_maintenance.cleanup_completed(7).await {
                error!("Error cleaning up completed items: {}", e);
            }
        }
    });
    
    let listener = tokio::net::TcpListener::bind(&config.server_address).await?;
    info!("Server starting on {}", config.server_address);
    
    axum::serve(listener, app).await?;
    
    Ok(())
}


async fn serve_spa() -> Result<Html<String>, StatusCode> {
    match tokio::fs::read_to_string("/app/frontend/index.html").await {
        Ok(html) => Ok(Html(html)),
        Err(_) => Err(StatusCode::NOT_FOUND),
    }
}
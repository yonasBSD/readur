use axum::{
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use std::sync::Arc;
use tower_http::{cors::CorsLayer, services::ServeDir};
use tracing::{info, error};

mod auth;
mod config;
mod db;
mod file_service;
mod models;
mod ocr;
mod routes;
mod seed;
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
        .route("/api/health", get(health_check))
        .nest("/api/auth", routes::auth::router())
        .nest("/api/documents", routes::documents::router())
        .nest("/api/search", routes::search::router())
        .nest("/api/settings", routes::settings::router())
        .nest("/api/users", routes::users::router())
        .nest_service("/", ServeDir::new("/app/frontend"))
        .layer(CorsLayer::permissive())
        .with_state(Arc::new(state));
    
    let watcher_config = config.clone();
    tokio::spawn(async move {
        if let Err(e) = watcher::start_folder_watcher(watcher_config).await {
            error!("Folder watcher error: {}", e);
        }
    });
    
    let listener = tokio::net::TcpListener::bind(&config.server_address).await?;
    info!("Server starting on {}", config.server_address);
    
    axum::serve(listener, app).await?;
    
    Ok(())
}

async fn health_check() -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({"status": "ok"})))
}
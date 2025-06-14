pub mod auth;
pub mod batch_ingest;
pub mod config;
pub mod db;
pub mod enhanced_ocr;
pub mod file_service;
pub mod models;
pub mod ocr;
pub mod ocr_queue;
pub mod routes;
pub mod seed;
pub mod watcher;
pub mod webdav_service;
pub mod webdav_scheduler;

#[cfg(test)]
mod tests;

use axum::{http::StatusCode, Json};
use config::Config;
use db::Database;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: Config,
}

/// Health check endpoint for monitoring
pub async fn health_check() -> Result<Json<serde_json::Value>, StatusCode> {
    Ok(Json(serde_json::json!({"status": "ok"})))
}

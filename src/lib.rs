pub mod auth;
pub mod batch_ingest;
pub mod config;
pub mod db;
pub mod file_service;
pub mod models;
pub mod ocr;
pub mod ocr_queue;
pub mod routes;
pub mod seed;
pub mod watcher;

use config::Config;
use db::Database;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: Config,
}
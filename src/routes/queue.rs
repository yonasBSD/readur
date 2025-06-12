use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use std::sync::Arc;

use crate::{auth::AuthUser, ocr_queue::OcrQueueService, AppState};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/stats", get(get_queue_stats))
        .route("/requeue-failed", post(requeue_failed))
}

async fn get_queue_stats(
    State(state): State<Arc<AppState>>,
    _auth_user: AuthUser, // Require authentication
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = sqlx::PgPool::connect(&state.config.database_url)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let queue_service = OcrQueueService::new(state.db.clone(), pool, 1);
    
    let stats = queue_service
        .get_stats()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(serde_json::json!({
        "pending": stats.pending_count,
        "processing": stats.processing_count,
        "failed": stats.failed_count,
        "completed_today": stats.completed_today,
        "avg_wait_time_minutes": stats.avg_wait_time_minutes,
        "oldest_pending_minutes": stats.oldest_pending_minutes,
    })))
}

use axum::routing::post;

async fn requeue_failed(
    State(state): State<Arc<AppState>>,
    _auth_user: AuthUser, // Require authentication
) -> Result<Json<serde_json::Value>, StatusCode> {
    let pool = sqlx::PgPool::connect(&state.config.database_url)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let queue_service = OcrQueueService::new(state.db.clone(), pool, 1);
    
    let count = queue_service
        .requeue_failed_items()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(Json(serde_json::json!({
        "requeued_count": count,
    })))
}
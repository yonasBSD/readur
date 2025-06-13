use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde_json::Value;
use tracing::{error, info};

use crate::{
    auth::AuthUser,
    models::{
        Settings, WebDAVConnectionResult, WebDAVCrawlEstimate, WebDAVSyncStatus,
        WebDAVTestConnection,
    },
    AppState,
};

// use crate::webdav_service::{WebDAVConfig, WebDAVService};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/test-connection", post(test_webdav_connection))
        .route("/estimate-crawl", post(estimate_webdav_crawl))
        .route("/sync-status", get(get_webdav_sync_status))
        .route("/start-sync", post(start_webdav_sync))
}

#[utoipa::path(
    post,
    path = "/api/webdav/test-connection",
    tag = "webdav",
    security(
        ("bearer_auth" = [])
    ),
    request_body = WebDAVTestConnection,
    responses(
        (status = 200, description = "Connection test result", body = WebDAVConnectionResult),
        (status = 400, description = "Invalid request data"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    )
)]
async fn test_webdav_connection(
    State(_state): State<Arc<AppState>>,
    _auth_user: AuthUser,
    Json(test_config): Json<WebDAVTestConnection>,
) -> Result<Json<WebDAVConnectionResult>, StatusCode> {
    info!("Testing WebDAV connection to: {}", test_config.server_url);

    // TODO: Implement actual WebDAV connection testing
    let result = WebDAVConnectionResult {
        success: true,
        message: "WebDAV connection test not yet implemented".to_string(),
        server_version: None,
        server_type: test_config.server_type,
    };

    Ok(Json(result))
}

#[utoipa::path(
    post,
    path = "/api/webdav/estimate-crawl",
    tag = "webdav",
    security(
        ("bearer_auth" = [])
    ),
    request_body = Value,
    responses(
        (status = 200, description = "Crawl estimate", body = WebDAVCrawlEstimate),
        (status = 400, description = "Invalid request data"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    )
)]
async fn estimate_webdav_crawl(
    State(_state): State<Arc<AppState>>,
    _auth_user: AuthUser,
    Json(request): Json<Value>,
) -> Result<Json<WebDAVCrawlEstimate>, StatusCode> {
    let folders = request
        .get("folders")
        .and_then(|f| f.as_array())
        .ok_or(StatusCode::BAD_REQUEST)?
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect::<Vec<String>>();

    info!("Estimating crawl for {} folders", folders.len());

    // TODO: Implement actual crawl estimation
    let estimate = WebDAVCrawlEstimate {
        folders: vec![],
        total_files: 0,
        total_supported_files: 0,
        total_estimated_time_hours: 0.0,
        total_size_mb: 0.0,
    };

    Ok(Json(estimate))
}

#[utoipa::path(
    get,
    path = "/api/webdav/sync-status",
    tag = "webdav",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "Current sync status", body = WebDAVSyncStatus),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    )
)]
async fn get_webdav_sync_status(
    State(_state): State<Arc<AppState>>,
    _auth_user: AuthUser,
) -> Result<Json<WebDAVSyncStatus>, StatusCode> {
    // TODO: Implement actual sync status
    let status = WebDAVSyncStatus {
        is_running: false,
        last_sync: None,
        files_processed: 0,
        files_remaining: 0,
        current_folder: None,
        errors: vec!["WebDAV sync not yet implemented".to_string()],
    };

    Ok(Json(status))
}

#[utoipa::path(
    post,
    path = "/api/webdav/start-sync",
    tag = "webdav",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "Sync started successfully"),
        (status = 400, description = "WebDAV not configured or already running"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    )
)]
async fn start_webdav_sync(
    State(_state): State<Arc<AppState>>,
    auth_user: AuthUser,
) -> Result<Json<Value>, StatusCode> {
    info!("Starting WebDAV sync for user: {}", auth_user.user.username);

    // TODO: Implement actual sync logic
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "WebDAV sync not yet implemented"
    })))
}
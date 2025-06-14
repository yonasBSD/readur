use std::sync::Arc;
use std::path::Path;

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde_json::Value;
use tracing::{error, info, warn};

use crate::{
    auth::AuthUser,
    models::{
        WebDAVConnectionResult, WebDAVCrawlEstimate, WebDAVSyncStatus,
        WebDAVTestConnection,
    },
    ocr_queue::OcrQueueService,
    file_service::FileService,
    AppState,
};
use crate::webdav_service::WebDAVConfig;
use crate::webdav_service::WebDAVService;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/test-connection", post(test_webdav_connection))
        .route("/estimate-crawl", post(estimate_webdav_crawl))
        .route("/sync-status", get(get_webdav_sync_status))
        .route("/start-sync", post(start_webdav_sync))
}

async fn get_user_webdav_config(state: &Arc<AppState>, user_id: uuid::Uuid) -> Result<WebDAVConfig, StatusCode> {
    let settings = state
        .db
        .get_user_settings(user_id)
        .await
        .map_err(|e| {
            error!("Failed to get user settings: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let settings = settings.unwrap_or_default();

    if !settings.webdav_enabled {
        error!("WebDAV is not enabled for user {}", user_id);
        return Err(StatusCode::BAD_REQUEST);
    }

    let server_url = settings.webdav_server_url.unwrap_or_default();
    let username = settings.webdav_username.unwrap_or_default();
    let password = settings.webdav_password.unwrap_or_default();

    if server_url.is_empty() || username.is_empty() {
        error!("WebDAV configuration incomplete for user {}", user_id);
        return Err(StatusCode::BAD_REQUEST);
    }

    Ok(WebDAVConfig {
        server_url,
        username,
        password,
        watch_folders: settings.webdav_watch_folders,
        file_extensions: settings.webdav_file_extensions,
        timeout_seconds: 30, // Default timeout
        server_type: Some("nextcloud".to_string()), // Default to Nextcloud
    })
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
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(test_config): Json<WebDAVTestConnection>,
) -> Result<Json<WebDAVConnectionResult>, StatusCode> {
    info!("Testing WebDAV connection to: {} for user: {}", 
        test_config.server_url, auth_user.user.username);

    // Create WebDAV config from test data
    let webdav_config = WebDAVConfig {
        server_url: test_config.server_url.clone(),
        username: test_config.username.clone(),
        password: test_config.password.clone(),
        watch_folders: Vec::new(),
        file_extensions: Vec::new(),
        timeout_seconds: 30,
        server_type: test_config.server_type.clone(),
    };

    // Create WebDAV service and test connection
    match WebDAVService::new(webdav_config) {
        Ok(webdav_service) => {
            match webdav_service.test_connection(test_config).await {
                Ok(result) => {
                    info!("WebDAV connection test completed: {}", result.message);
                    Ok(Json(result))
                }
                Err(e) => {
                    error!("WebDAV connection test failed: {}", e);
                    Ok(Json(WebDAVConnectionResult {
                        success: false,
                        message: format!("Connection test failed: {}", e),
                        server_version: None,
                        server_type: None,
                    }))
                }
            }
        }
        Err(e) => {
            error!("Failed to create WebDAV service: {}", e);
            Ok(Json(WebDAVConnectionResult {
                success: false,
                message: format!("Service creation failed: {}", e),
                server_version: None,
                server_type: None,
            }))
        }
    }
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
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Json(request): Json<Value>,
) -> Result<Json<WebDAVCrawlEstimate>, StatusCode> {
    let folders = request
        .get("folders")
        .and_then(|f| f.as_array())
        .ok_or(StatusCode::BAD_REQUEST)?
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect::<Vec<String>>();

    info!("Estimating crawl for {} folders for user: {}", folders.len(), auth_user.user.username);

    // Get user's WebDAV configuration
    let webdav_config = match get_user_webdav_config(&state, auth_user.user.id).await {
        Ok(config) => config,
        Err(status_code) => {
            warn!("Could not get WebDAV config for user {}: {:?}", auth_user.user.id, status_code);
            return Ok(Json(WebDAVCrawlEstimate {
                folders: vec![],
                total_files: 0,
                total_supported_files: 0,
                total_estimated_time_hours: 0.0,
                total_size_mb: 0.0,
            }));
        }
    };

    // Create WebDAV service and estimate crawl
    match WebDAVService::new(webdav_config) {
        Ok(webdav_service) => {
            match webdav_service.estimate_crawl(&folders).await {
                Ok(estimate) => {
                    info!("Crawl estimation completed: {} total files, {} supported files", 
                        estimate.total_files, estimate.total_supported_files);
                    Ok(Json(estimate))
                }
                Err(e) => {
                    error!("Crawl estimation failed: {}", e);
                    Ok(Json(WebDAVCrawlEstimate {
                        folders: vec![],
                        total_files: 0,
                        total_supported_files: 0,
                        total_estimated_time_hours: 0.0,
                        total_size_mb: 0.0,
                    }))
                }
            }
        }
        Err(e) => {
            error!("Failed to create WebDAV service for crawl estimation: {}", e);
            Ok(Json(WebDAVCrawlEstimate {
                folders: vec![],
                total_files: 0,
                total_supported_files: 0,
                total_estimated_time_hours: 0.0,
                total_size_mb: 0.0,
            }))
        }
    }
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
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
) -> Result<Json<WebDAVSyncStatus>, StatusCode> {
    info!("Getting WebDAV sync status for user: {}", auth_user.user.username);

    // Check if WebDAV is configured
    let webdav_config = match get_user_webdav_config(&state, auth_user.user.id).await {
        Ok(config) => config,
        Err(_) => {
            return Ok(Json(WebDAVSyncStatus {
                is_running: false,
                last_sync: None,
                files_processed: 0,
                files_remaining: 0,
                current_folder: None,
                errors: vec!["WebDAV not configured".to_string()],
            }));
        }
    };

    // For now, return basic status - in production you'd query the webdav_sync_state table
    // TODO: Read actual sync state from database
    let status = WebDAVSyncStatus {
        is_running: false,
        last_sync: None,
        files_processed: 0,
        files_remaining: 0,
        current_folder: None,
        errors: Vec::new(),
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
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
) -> Result<Json<Value>, StatusCode> {
    info!("Starting WebDAV sync for user: {}", auth_user.user.username);

    // Get user's WebDAV configuration and settings
    let webdav_config = get_user_webdav_config(&state, auth_user.user.id).await?;
    
    let user_settings = state
        .db
        .get_user_settings(auth_user.user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .unwrap_or_default();

    // Create WebDAV service
    let webdav_service = WebDAVService::new(webdav_config.clone())
        .map_err(|e| {
            error!("Failed to create WebDAV service: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Start sync in background task
    let state_clone = state.clone();
    let user_id = auth_user.user.id;
    let enable_background_ocr = user_settings.enable_background_ocr;
    
    tokio::spawn(async move {
        match perform_webdav_sync(state_clone.clone(), user_id, webdav_service, webdav_config, enable_background_ocr).await {
            Ok(files_processed) => {
                info!("WebDAV sync completed successfully for user {}: {} files processed", user_id, files_processed);
                
                // Send success notification
                let notification = crate::models::CreateNotification {
                    notification_type: "success".to_string(),
                    title: "Manual WebDAV Sync Completed".to_string(),
                    message: if files_processed > 0 {
                        format!("Successfully processed {} files from manual WebDAV sync", files_processed)
                    } else {
                        "Manual WebDAV sync completed - no new files found".to_string()
                    },
                    action_url: Some("/documents".to_string()),
                    metadata: Some(serde_json::json!({
                        "sync_type": "webdav_manual",
                        "files_processed": files_processed
                    })),
                };
                
                if let Err(e) = state_clone.db.create_notification(user_id, &notification).await {
                    error!("Failed to create success notification: {}", e);
                }
            }
            Err(e) => {
                error!("WebDAV sync failed for user {}: {}", user_id, e);
                
                // Send error notification
                let notification = crate::models::CreateNotification {
                    notification_type: "error".to_string(),
                    title: "Manual WebDAV Sync Failed".to_string(),
                    message: format!("Manual WebDAV sync encountered an error: {}", e),
                    action_url: Some("/settings".to_string()),
                    metadata: Some(serde_json::json!({
                        "sync_type": "webdav_manual",
                        "error": e.to_string()
                    })),
                };
                
                if let Err(e) = state_clone.db.create_notification(user_id, &notification).await {
                    error!("Failed to create error notification: {}", e);
                }
            }
        }
    });

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "WebDAV sync started successfully"
    })))
}

async fn perform_webdav_sync(
    state: Arc<AppState>,
    user_id: uuid::Uuid,
    webdav_service: WebDAVService,
    config: WebDAVConfig,
    enable_background_ocr: bool,
) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
    info!("Performing WebDAV sync for user {} on {} folders", user_id, config.watch_folders.len());
    
    let mut files_processed = 0;
    
    // Process each watch folder
    for folder_path in &config.watch_folders {
        info!("Syncing folder: {}", folder_path);
        
        // Discover files in the folder
        match webdav_service.discover_files_in_folder(folder_path).await {
            Ok(files) => {
                info!("Found {} files in folder {}", files.len(), folder_path);
                
                for file_info in files {
                    if file_info.is_directory {
                        continue; // Skip directories
                    }
                    
                    // Check if file extension is supported
                    let file_extension = Path::new(&file_info.name)
                        .extension()
                        .and_then(|ext| ext.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    
                    if !config.file_extensions.contains(&file_extension) {
                        continue; // Skip unsupported file types
                    }
                    
                    // Check if we've already processed this file
                    // TODO: Check webdav_files table for existing files with same etag
                    
                    // Download the file
                    match webdav_service.download_file(&file_info.path).await {
                        Ok(file_data) => {
                            info!("Downloaded file: {} ({} bytes)", file_info.name, file_data.len());
                            
                            // Create file service and save file to disk first
                            let file_service = FileService::new(state.config.upload_path.clone());
                            
                            let saved_file_path = match file_service.save_file(&file_info.name, &file_data).await {
                                Ok(path) => path,
                                Err(e) => {
                                    error!("Failed to save file {}: {}", file_info.name, e);
                                    continue;
                                }
                            };
                            
                            // Create document record
                            let document = file_service.create_document(
                                &file_info.name,
                                &file_info.name, // original filename same as name
                                &saved_file_path,
                                file_info.size,
                                &file_info.mime_type,
                                user_id,
                            );
                            
                            // Save document to database
                            match state.db.create_document(document).await {
                                Ok(saved_document) => {
                                    info!("Created document record: {} (ID: {})", file_info.name, saved_document.id);
                                    
                                    // Add to OCR queue if enabled
                                    if enable_background_ocr {
                                        match sqlx::PgPool::connect(&state.config.database_url).await {
                                            Ok(pool) => {
                                                let queue_service = OcrQueueService::new(state.db.clone(), pool, 1);
                                                
                                                // Calculate priority based on file size
                                                let priority = match file_info.size {
                                                    0..=1048576 => 10,          // <= 1MB: highest priority
                                                    ..=5242880 => 8,            // 1-5MB: high priority
                                                    ..=10485760 => 6,           // 5-10MB: medium priority  
                                                    ..=52428800 => 4,           // 10-50MB: low priority
                                                    _ => 2,                     // > 50MB: lowest priority
                                                };
                                                
                                                if let Err(e) = queue_service.enqueue_document(saved_document.id, priority, file_info.size).await {
                                                    error!("Failed to enqueue document for OCR: {}", e);
                                                } else {
                                                    info!("Enqueued document {} for OCR processing", saved_document.id);
                                                }
                                            }
                                            Err(e) => {
                                                error!("Failed to connect to database for OCR queueing: {}", e);
                                            }
                                        }
                                    }
                                    
                                    // TODO: Record in webdav_files table for tracking
                                    files_processed += 1;
                                }
                                Err(e) => {
                                    error!("Failed to create document record for {}: {}", file_info.name, e);
                                }
                            }
                        }
                        Err(e) => {
                            error!("Failed to download file {}: {}", file_info.path, e);
                        }
                    }
                }
            }
            Err(e) => {
                error!("Failed to discover files in folder {}: {}", folder_path, e);
            }
        }
    }
    
    info!("WebDAV sync completed for user {}: {} files processed", user_id, files_processed);
    Ok(files_processed)
}
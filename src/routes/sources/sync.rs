use axum::{
    extract::{Path, State, WebSocketUpgrade},
    extract::ws::{WebSocket, Message},
    http::{StatusCode, HeaderMap},
    response::{Json, Response},
};
use std::sync::Arc;
use uuid::Uuid;
use tracing::{error, info};
use std::time::Duration;

use crate::{
    auth::AuthUser,
    models::SourceStatus,
    services::webdav::{SyncProgress, SyncPhase},
    AppState,
};

// Removed WebSocketAuthQuery - using secure header-based authentication instead

/// Trigger a sync for a source
#[utoipa::path(
    post,
    path = "/api/sources/{id}/sync",
    tag = "sources",
    security(
        ("bearer_auth" = [])
    ),
    params(
        ("id" = Uuid, Path, description = "Source ID")
    ),
    responses(
        (status = 200, description = "Sync triggered successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Source not found"),
        (status = 409, description = "Source is already syncing"),
        (status = 500, description = "Internal server error"),
        (status = 501, description = "Not implemented - Source type not supported")
    )
)]
pub async fn trigger_sync(
    auth_user: AuthUser,
    Path(source_id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, StatusCode> {
    let source = state
        .db
        .get_source(auth_user.user.id, source_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Trigger sync using the universal source scheduler
    // The scheduler will handle all status checks and atomic operations
    if let Some(scheduler) = &state.source_scheduler {
        match scheduler.trigger_sync(source_id).await {
            Ok(()) => {
                // Sync started successfully
            }
            Err(e) => {
                let error_msg = e.to_string();
                error!("Failed to trigger sync for source {}: {}", source_id, error_msg);
                
                // Map specific errors to appropriate HTTP status codes
                if error_msg.contains("already syncing") || error_msg.contains("already running") {
                    return Err(StatusCode::CONFLICT);
                } else if error_msg.contains("not found") {
                    return Err(StatusCode::NOT_FOUND);
                } else {
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
        }
    } else {
        // Fallback to WebDAV scheduler for backward compatibility
        match source.source_type {
            crate::models::SourceType::WebDAV => {
                if let Some(webdav_scheduler) = &state.webdav_scheduler {
                    webdav_scheduler.trigger_sync(source_id).await;
                } else {
                    state
                        .db
                        .update_source_status(
                            source_id,
                            SourceStatus::Error,
                            Some("No scheduler available".to_string()),
                        )
                        .await
                        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                    return Err(StatusCode::INTERNAL_SERVER_ERROR);
                }
            }
            _ => {
                state
                    .db
                    .update_source_status(
                        source_id,
                        SourceStatus::Error,
                        Some("Source type not supported".to_string()),
                    )
                    .await
                    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
                return Err(StatusCode::NOT_IMPLEMENTED);
            }
        }
    }

    Ok(StatusCode::OK)
}

/// Stop sync for a source
#[utoipa::path(
    post,
    path = "/api/sources/{id}/sync/stop",
    tag = "sources",
    security(
        ("bearer_auth" = [])
    ),
    params(
        ("id" = Uuid, Path, description = "Source ID")
    ),
    responses(
        (status = 200, description = "Sync stopped successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Source not found"),
        (status = 409, description = "Source is not currently syncing"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn stop_sync(
    auth_user: AuthUser,
    Path(source_id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> Result<StatusCode, StatusCode> {
    let source = state
        .db
        .get_source(auth_user.user.id, source_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Allow stopping sync regardless of current status to handle edge cases
    // where the database status might be out of sync with actual running tasks

    // Stop sync using the universal source scheduler
    if let Some(scheduler) = &state.source_scheduler {
        if let Err(e) = scheduler.stop_sync(source_id).await {
            let error_msg = e.to_string();
            // If no sync is running, treat it as success since the desired state is achieved
            if error_msg.contains("No running sync found") {
                info!("No sync was running for source {}, ensuring status is idle", source_id);
                // Use atomic operation to ensure status is idle if not already syncing
                let _ = state
                    .db
                    .update_source_status_atomic(
                        source_id,
                        None, // Don't check current status
                        SourceStatus::Idle,
                        Some("No sync was running")
                    )
                    .await;
            } else {
                error!("Failed to stop sync for source {}: {}", source_id, e);
                return Err(StatusCode::INTERNAL_SERVER_ERROR);
            }
        }
    } else {
        // Update status directly if no scheduler available (fallback)
        state
            .db
            .update_source_status(
                source_id,
                SourceStatus::Idle,
                Some("Sync cancelled by user".to_string()),
            )
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    Ok(StatusCode::OK)
}

/// Trigger a deep scan for a source
#[utoipa::path(
    post,
    path = "/api/sources/{id}/deep-scan",
    tag = "sources",
    security(
        ("bearer_auth" = [])
    ),
    params(
        ("id" = Uuid, Path, description = "Source ID")
    ),
    responses(
        (status = 200, description = "Deep scan started successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Source not found"),
        (status = 409, description = "Source is already syncing"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn trigger_deep_scan(
    auth_user: AuthUser,
    Path(source_id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    info!("Starting deep scan for source {} by user {}", source_id, auth_user.user.username);
    
    let source = state
        .db
        .get_source(auth_user.user.id, source_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Check if source is already syncing
    if matches!(source.status, SourceStatus::Syncing) {
        return Ok(Json(serde_json::json!({
            "success": false,
            "error": "source_already_syncing",
            "message": "Source is already syncing. Please wait for the current sync to complete before starting a deep scan."
        })));
    }

    match source.source_type {
        crate::models::SourceType::WebDAV => {
            // Handle WebDAV deep scan
            let config: crate::models::WebDAVSourceConfig = serde_json::from_value(source.config)
                .map_err(|e| {
                    error!("Failed to parse WebDAV config for source {}: {}", source_id, e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            // Create WebDAV service
            let webdav_config = crate::services::webdav::WebDAVConfig {
                server_url: config.server_url.clone(),
                username: config.username.clone(),
                password: config.password.clone(),
                watch_folders: config.watch_folders.clone(),
                file_extensions: config.file_extensions.clone(),
                timeout_seconds: 600, // 10 minutes for deep scan
                server_type: config.server_type.clone(),
            };

            let webdav_service = crate::services::webdav::WebDAVService::new(webdav_config.clone())
                .map_err(|e| {
                    error!("Failed to create WebDAV service for deep scan: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            // Update source status to syncing
            state
                .db
                .update_source_status(
                    source_id,
                    SourceStatus::Syncing,
                    Some("Deep scan in progress - this can take a while, especially initial requests".to_string()),
                )
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            // Start deep scan in background
            let state_clone = state.clone();
            let user_id = auth_user.user.id;
            let source_name = source.name.clone();
            let source_id_clone = source_id;
            let config_clone = config.clone();
            
            tokio::spawn(async move {
                let start_time = chrono::Utc::now();
                
                // Create progress tracker for manual deep scan
                let progress = Arc::new(SyncProgress::new());
                progress.set_phase(SyncPhase::Initializing);
                
                // Register progress with global tracker so SSE can find it
                state_clone.sync_progress_tracker.register_sync(source_id_clone, progress.clone());
                info!("🚀 Starting manual deep scan with progress tracking for source '{}'", source_name);
                
                let mut progress_unregistered = false;
                
                // Use smart sync service for deep scans - this will properly reset directory ETags
                let smart_sync_service = crate::services::webdav::SmartSyncService::new(state_clone.clone());
                let mut all_files_to_process = Vec::new();
                let mut total_directories_tracked = 0;
                
                // Process each watch folder using smart sync
                for watch_folder in &webdav_config.watch_folders {
                    info!("🔍 Deep scan processing watch folder: {}", watch_folder);
                    progress.set_current_directory(&watch_folder);
                    
                    match smart_sync_service.perform_smart_sync(
                        user_id, 
                        &webdav_service, 
                        watch_folder, 
                        crate::services::webdav::SmartSyncStrategy::FullDeepScan, // Force deep scan for directory reset
                        Some(&progress) // Add progress tracking for manual deep scan
                    ).await {
                        Ok(sync_result) => {
                            info!("Deep scan found {} files and {} directories in {}", 
                                  sync_result.files.len(), sync_result.directories.len(), watch_folder);
                            
                            // Filter files by extensions 
                            let filtered_files: Vec<_> = sync_result.files.into_iter()
                                .filter(|file_info| {
                                    let file_extension = std::path::Path::new(&file_info.name)
                                        .extension()
                                        .and_then(|ext| ext.to_str())
                                        .unwrap_or("")
                                        .to_lowercase();
                                    config_clone.file_extensions.contains(&file_extension)
                                })
                                .collect();
                                
                            all_files_to_process.extend(filtered_files);
                            total_directories_tracked += sync_result.directories.len();
                        }
                        Err(e) => {
                            let error_msg = format!("Deep scan failed for watch folder {}: {}", watch_folder, e);
                            error!("{}", error_msg);
                            progress.add_error(&error_msg);
                            // Continue with other folders rather than failing completely
                        }
                    }
                }
                
                if !all_files_to_process.is_empty() {
                    info!("Deep scan will process {} files from {} directories for source {}", 
                          all_files_to_process.len(), total_directories_tracked, source_id_clone);
                        
                            // Process files using the existing sync mechanism
                            match crate::routes::webdav::webdav_sync::process_files_for_deep_scan(
                                state_clone.clone(),
                                user_id,
                                &webdav_service,
                                &all_files_to_process,
                                true, // enable background OCR
                                Some(source_id_clone)
                            ).await {
                                Ok(files_processed) => {
                                    let duration = chrono::Utc::now() - start_time;
                                    info!("Deep scan completed for source {}: {} files processed in {:?}", 
                                        source_id_clone, files_processed, duration);
                                    
                                    // Mark progress as completed and log final statistics
                                    progress.set_phase(SyncPhase::Completed);
                                    if let Some(stats) = progress.get_stats() {
                                        info!("📊 Manual deep scan statistics: {} files processed, {} errors, {} warnings, elapsed: {}s", 
                                              stats.files_processed, stats.errors.len(), stats.warnings, stats.elapsed_time.as_secs());
                                    }
                                    
                                    // Unregister progress from global tracker
                                    if !progress_unregistered {
                                        state_clone.sync_progress_tracker.unregister_sync(source_id_clone);
                                        progress_unregistered = true;
                                    }
                                    
                                    // Update source status to idle
                                    if let Err(e) = state_clone.db.update_source_status(
                                        source_id_clone,
                                        SourceStatus::Idle,
                                        Some(format!("Deep scan completed: {} files processed", files_processed)),
                                    ).await {
                                        error!("Failed to update source status after deep scan: {}", e);
                                    }
                                    
                                    // Send success notification
                                    let notification = crate::models::CreateNotification {
                                        notification_type: "success".to_string(),
                                        title: "Deep Scan Completed".to_string(),
                                        message: format!(
                                            "Smart deep scan of {} completed successfully. {} files processed, {} directories tracked in {:.1} minutes.",
                                            source_name,
                                            files_processed,
                                            total_directories_tracked,
                                            duration.num_seconds() as f64 / 60.0
                                        ),
                                        action_url: Some("/documents".to_string()),
                                        metadata: Some(serde_json::json!({
                                            "source_id": source_id_clone,
                                            "scan_type": "deep_scan",
                                            "files_processed": files_processed,
                                            "duration_seconds": duration.num_seconds()
                                        })),
                                    };
                                    
                                    if let Err(e) = state_clone.db.create_notification(user_id, &notification).await {
                                        error!("Failed to create deep scan success notification: {}", e);
                                    }
                                }
                                Err(e) => {
                                    error!("Deep scan file processing failed for source {}: {}", source_id_clone, e);
                                    
                                    // Mark progress as failed and log error
                                    progress.set_phase(SyncPhase::Failed(e.to_string()));
                                    progress.add_error(&format!("File processing failed: {}", e));
                                    
                                    // Unregister progress from global tracker
                                    if !progress_unregistered {
                                        state_clone.sync_progress_tracker.unregister_sync(source_id_clone);
                                        progress_unregistered = true;
                                    }
                                    
                                    // Update source status to error
                                    if let Err(e2) = state_clone.db.update_source_status(
                                        source_id_clone,
                                        SourceStatus::Error,
                                        Some(format!("Deep scan failed: {}", e)),
                                    ).await {
                                        error!("Failed to update source status after deep scan error: {}", e2);
                                    }
                                    
                                    // Send error notification
                                    let notification = crate::models::CreateNotification {
                                        notification_type: "error".to_string(),
                                        title: "Deep Scan Failed".to_string(),
                                        message: format!("Deep scan of {} failed: {}", source_name, e),
                                        action_url: Some("/sources".to_string()),
                                        metadata: Some(serde_json::json!({
                                            "source_id": source_id_clone,
                                            "scan_type": "deep_scan",
                                            "error": e.to_string()
                                        })),
                                    };
                                    
                                    if let Err(e) = state_clone.db.create_notification(user_id, &notification).await {
                                        error!("Failed to create deep scan error notification: {}", e);
                                    }
                                }
                            }

                        } else {
                            info!("Deep scan found no files but tracked {} directories for source {}", 
                                  total_directories_tracked, source_id_clone);
                            
                            // Mark progress as completed (no files found case)
                            progress.set_phase(SyncPhase::Completed);
                            
                            // Unregister progress from global tracker
                            if !progress_unregistered {
                                state_clone.sync_progress_tracker.unregister_sync(source_id_clone);
                                progress_unregistered = true;
                            }
                            
                            // Update source status to idle even if no files found
                            if let Err(e) = state_clone.db.update_source_status(
                                source_id_clone,
                                SourceStatus::Idle,
                                Some(format!("Smart deep scan completed: {} directories tracked, no files found", total_directories_tracked)),
                            ).await {
                                error!("Failed to update source status after empty deep scan: {}", e);
                            }
                        }
                        
                        // Ensure progress is always unregistered at the end, even if we missed a case
                        if !progress_unregistered {
                            state_clone.sync_progress_tracker.unregister_sync(source_id_clone);
                        }
            });

            Ok(Json(serde_json::json!({
                "success": true,
                "message": format!("Deep scan started for source '{}'. This will perform a complete rescan of all configured folders.", source.name)
            })))
        }
        _ => {
            error!("Deep scan not supported for source type: {:?}", source.source_type);
            Ok(Json(serde_json::json!({
                "success": false,
                "error": "unsupported_source_type",
                "message": "Deep scan is currently only supported for WebDAV sources"
            })))
        }
    }
}


/// WebSocket endpoint for real-time sync progress updates
/// 
/// This endpoint provides real-time updates about source synchronization progress via WebSocket.
/// It sends progress messages every second during active sync operations and heartbeat messages
/// when no sync is running. This replaces the previous Server-Sent Events (SSE) implementation
/// with improved security by using query parameter authentication instead of exposing JWT tokens.
/// 
/// # Message Types
/// - `progress`: Real-time sync progress updates with detailed statistics
/// - `heartbeat`: Keep-alive messages when no sync is active
/// - `error`: Error messages for connection or sync issues
/// - `connection_confirmed`: Confirmation that the WebSocket connection is established
/// 
/// # Security
/// Authentication is handled via JWT token in the `Sec-WebSocket-Protocol` header during WebSocket handshake.
/// This secure approach prevents token exposure in logs, browser history, and referrer headers.
#[utoipa::path(
    get,
    path = "/api/sources/{id}/sync/progress/ws",
    tag = "sources",
    security(
        ("bearer_auth" = [])
    ),
    params(
        ("id" = Uuid, Path, description = "Source ID to monitor for sync progress")
    ),
    responses(
        (status = 101, description = "WebSocket connection established - will stream real-time progress updates"),
        (status = 401, description = "Unauthorized - invalid or missing authentication token"),
        (status = 404, description = "Source not found or user does not have access"),
        (status = 500, description = "Internal server error during WebSocket upgrade")
    )
)]
pub async fn sync_progress_websocket(
    ws: WebSocketUpgrade,
    Path(source_id): Path<Uuid>,
    headers: HeaderMap,
    State(state): State<Arc<AppState>>,
) -> Result<Response, StatusCode> {
    // Extract and verify token from Sec-WebSocket-Protocol header for secure WebSocket auth
    let token = extract_websocket_token(&headers).ok_or(StatusCode::UNAUTHORIZED)?;
    
    let claims = crate::auth::verify_jwt(&token, &state.config.jwt_secret)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    
    let user = state.db.get_user_by_id(claims.sub).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;
    
    // Verify the source exists and the user has access
    let _source = state
        .db
        .get_source(user.id, source_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Upgrade the connection to WebSocket
    Ok(ws.on_upgrade(move |socket| handle_websocket(socket, source_id, state)))
}

/// Handle WebSocket connection for sync progress updates
async fn handle_websocket(mut socket: WebSocket, source_id: Uuid, state: Arc<AppState>) {
    info!("WebSocket connection established for source {}", source_id);
    
    // Send connection confirmation
    let confirmation_msg = serde_json::json!({
        "type": "connection_confirmed",
        "data": {
            "source_id": source_id,
            "timestamp": chrono::Utc::now().timestamp()
        }
    });
    
    if let Err(e) = socket.send(Message::Text(confirmation_msg.to_string().into())).await {
        error!("Failed to send connection confirmation for source {}: {}", source_id, e);
        return;
    }
    
    let progress_tracker = state.sync_progress_tracker.clone();
    
    loop {
        // Check for progress update
        let progress_info = progress_tracker.get_progress(source_id);
        
        let message = match progress_info {
            Some(info) => {
                // Send current progress
                match serde_json::to_string(&serde_json::json!({
                    "type": "progress",
                    "data": info
                })) {
                    Ok(json) => Message::Text(json.into()),
                    Err(e) => {
                        error!("Failed to serialize progress info: {}", e);
                        let error_msg = serde_json::json!({
                            "type": "error",
                            "data": {
                                "message": format!("Failed to serialize progress: {}", e),
                                "error_type": "serialization_error"
                            }
                        });
                        Message::Text(error_msg.to_string().into())
                    }
                }
            }
            None => {
                // No active sync, send a heartbeat
                Message::Text(serde_json::json!({
                    "type": "heartbeat",
                    "data": {
                        "source_id": source_id,
                        "is_active": false,
                        "timestamp": chrono::Utc::now().timestamp()
                    }
                }).to_string().into())
            }
        };
        
        // Send the message to the client
        if let Err(e) = socket.send(message).await {
            error!("Failed to send WebSocket message for source {}: {}", source_id, e);
            
            // Try to send error notification to client before breaking
            let error_notification = serde_json::json!({
                "type": "error",
                "data": {
                    "message": "Connection error occurred, closing connection",
                    "error_type": "connection_error",
                    "details": e.to_string()
                }
            });
            
            // Attempt to send error message (ignore if this fails too)
            let _ = socket.send(Message::Text(error_notification.to_string().into())).await;
            break;
        }
        
        // Wait before next update
        tokio::time::sleep(Duration::from_secs(1)).await;
        
        // Check if the connection is still alive by trying to send a ping
        if let Err(e) = socket.send(Message::Ping(vec![].into())).await {
            info!("WebSocket connection closed for source {} (ping failed: {})", source_id, e);
            
            // Try to send graceful closure message
            let closure_msg = serde_json::json!({
                "type": "error",
                "data": {
                    "message": "Connection lost during ping check",
                    "error_type": "ping_failed",
                    "details": e.to_string()
                }
            });
            
            // Attempt to send closure message (ignore if this fails)
            let _ = socket.send(Message::Text(closure_msg.to_string().into())).await;
            break;
        }
    }
    
    // Send final close message if connection is still open
    let close_msg = serde_json::json!({
        "type": "connection_closing",
        "data": {
            "source_id": source_id,
            "message": "Server is closing connection",
            "timestamp": chrono::Utc::now().timestamp()
        }
    });
    
    // Try to send close notification (ignore failures)
    let _ = socket.send(Message::Text(close_msg.to_string().into())).await;
    
    info!("WebSocket connection terminated for source {}", source_id);
}

/// Extract JWT token from WebSocket headers securely
/// Uses Sec-WebSocket-Protocol header to avoid token exposure in logs/URLs
fn extract_websocket_token(headers: &HeaderMap) -> Option<String> {
    // Check for token in Sec-WebSocket-Protocol header (most secure)
    if let Some(protocol_header) = headers.get("sec-websocket-protocol") {
        if let Ok(protocols) = protocol_header.to_str() {
            // Format: "bearer.{token}" or "bearer, {token}"
            for protocol in protocols.split(',') {
                let protocol = protocol.trim();
                if protocol.starts_with("bearer.") {
                    return Some(protocol.trim_start_matches("bearer.").to_string());
                }
                if protocol.starts_with("bearer ") {
                    return Some(protocol.trim_start_matches("bearer ").to_string());
                }
            }
        }
    }
    
    // Fallback to Authorization header for backward compatibility
    if let Some(auth_header) = headers.get("authorization") {
        if let Ok(auth_str) = auth_header.to_str() {
            if auth_str.starts_with("Bearer ") {
                return Some(auth_str.trim_start_matches("Bearer ").to_string());
            }
        }
    }
    
    None
}

/// Get current sync progress (one-time API call)
#[utoipa::path(
    get,
    path = "/api/sources/{id}/sync/status",
    tag = "sources",
    security(
        ("bearer_auth" = [])
    ),
    params(
        ("id" = Uuid, Path, description = "Source ID")
    ),
    responses(
        (status = 200, description = "Current sync progress", body = crate::services::sync_progress_tracker::SyncProgressInfo),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Source not found"),
        (status = 500, description = "Internal server error")
    )
)]
pub async fn get_sync_status(
    auth_user: AuthUser,
    Path(source_id): Path<Uuid>,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Option<crate::services::sync_progress_tracker::SyncProgressInfo>>, StatusCode> {
    // Verify the source exists and the user has access
    let _source = state
        .db
        .get_source(auth_user.user.id, source_id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Get current progress
    let progress_info = state.sync_progress_tracker.get_progress(source_id);
    
    Ok(Json(progress_info))
}
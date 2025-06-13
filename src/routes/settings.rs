use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, put},
    Router,
};
use std::sync::Arc;

use crate::{
    auth::AuthUser,
    models::{SettingsResponse, UpdateSettings},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(get_settings).put(update_settings))
}

#[utoipa::path(
    get,
    path = "/api/settings",
    tag = "settings",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "User settings", body = SettingsResponse),
        (status = 401, description = "Unauthorized")
    )
)]
async fn get_settings(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<SettingsResponse>, StatusCode> {
    let settings = state
        .db
        .get_user_settings(auth_user.user.id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = match settings {
        Some(s) => s.into(),
        None => {
            let default = crate::models::Settings::default();
            SettingsResponse {
                ocr_language: default.ocr_language,
                concurrent_ocr_jobs: default.concurrent_ocr_jobs,
                ocr_timeout_seconds: default.ocr_timeout_seconds,
                max_file_size_mb: default.max_file_size_mb,
                allowed_file_types: default.allowed_file_types,
                auto_rotate_images: default.auto_rotate_images,
                enable_image_preprocessing: default.enable_image_preprocessing,
                search_results_per_page: default.search_results_per_page,
                search_snippet_length: default.search_snippet_length,
                fuzzy_search_threshold: default.fuzzy_search_threshold,
                retention_days: default.retention_days,
                enable_auto_cleanup: default.enable_auto_cleanup,
                enable_compression: default.enable_compression,
                memory_limit_mb: default.memory_limit_mb,
                cpu_priority: default.cpu_priority,
                enable_background_ocr: default.enable_background_ocr,
            }
        },
    };

    Ok(Json(response))
}

#[utoipa::path(
    put,
    path = "/api/settings",
    tag = "settings",
    security(
        ("bearer_auth" = [])
    ),
    request_body = UpdateSettings,
    responses(
        (status = 200, description = "Settings updated successfully", body = SettingsResponse),
        (status = 400, description = "Bad request - invalid settings data"),
        (status = 401, description = "Unauthorized")
    )
)]
async fn update_settings(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(update_data): Json<UpdateSettings>,
) -> Result<Json<SettingsResponse>, StatusCode> {
    let settings = state
        .db
        .create_or_update_settings(auth_user.user.id, &update_data)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    Ok(Json(settings.into()))
}
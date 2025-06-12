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
        None => SettingsResponse {
            ocr_language: "eng".to_string(),
        },
    };

    Ok(Json(response))
}

async fn update_settings(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(update_data): Json<UpdateSettings>,
) -> Result<Json<SettingsResponse>, StatusCode> {
    let settings = state
        .db
        .create_or_update_settings(auth_user.user.id, &update_data.ocr_language)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    Ok(Json(settings.into()))
}
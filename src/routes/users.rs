use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    auth::AuthUser,
    models::{CreateUser, UpdateUser, UserResponse},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(list_users).post(create_user))
        .route("/:id", get(get_user).put(update_user).delete(delete_user))
}

async fn list_users(
    _auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<UserResponse>>, StatusCode> {
    let users = state
        .db
        .get_all_users()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let user_responses: Vec<UserResponse> = users.into_iter().map(|u| u.into()).collect();
    Ok(Json(user_responses))
}

async fn get_user(
    _auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<UserResponse>, StatusCode> {
    let user = state
        .db
        .get_user_by_id(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(user.into()))
}

async fn create_user(
    _auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    Json(user_data): Json<CreateUser>,
) -> Result<Json<UserResponse>, StatusCode> {
    let user = state
        .db
        .create_user(user_data)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    Ok(Json(user.into()))
}

async fn update_user(
    _auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(update_data): Json<UpdateUser>,
) -> Result<Json<UserResponse>, StatusCode> {
    let user = state
        .db
        .update_user(id, update_data.username, update_data.email, update_data.password)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    Ok(Json(user.into()))
}

async fn delete_user(
    auth_user: AuthUser,
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    // Prevent users from deleting themselves
    if auth_user.user.id == id {
        return Err(StatusCode::FORBIDDEN);
    }

    state
        .db
        .delete_user(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}
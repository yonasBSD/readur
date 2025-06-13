use axum::{
    extract::State,
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use std::sync::Arc;

use crate::{
    auth::{create_jwt, AuthUser},
    models::{CreateUser, LoginRequest, LoginResponse, UserResponse},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/me", get(me))
}

#[utoipa::path(
    post,
    path = "/api/auth/register",
    tag = "auth",
    request_body = CreateUser,
    responses(
        (status = 200, description = "User registered successfully", body = UserResponse),
        (status = 400, description = "Bad request - invalid user data")
    )
)]
async fn register(
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

#[utoipa::path(
    post,
    path = "/api/auth/login",
    tag = "auth",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Login successful", body = LoginResponse),
        (status = 401, description = "Unauthorized - invalid credentials")
    )
)]
async fn login(
    State(state): State<Arc<AppState>>,
    Json(login_data): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, StatusCode> {
    let user = state
        .db
        .get_user_by_username(&login_data.username)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let is_valid = bcrypt::verify(&login_data.password, &user.password_hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if !is_valid {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let token = create_jwt(&user, &state.config.jwt_secret)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(LoginResponse {
        token,
        user: user.into(),
    }))
}

#[utoipa::path(
    get,
    path = "/api/auth/me",
    tag = "auth",
    security(
        ("bearer_auth" = [])
    ),
    responses(
        (status = 200, description = "Current user information", body = UserResponse),
        (status = 401, description = "Unauthorized - invalid or missing token")
    )
)]
async fn me(auth_user: AuthUser) -> Json<UserResponse> {
    Json(auth_user.user.into())
}
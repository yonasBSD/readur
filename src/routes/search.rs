use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use std::sync::Arc;

use crate::{
    auth::AuthUser,
    models::{SearchRequest, SearchResponse},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new().route("/", get(search_documents))
}

async fn search_documents(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Query(search_request): Query<SearchRequest>,
) -> Result<Json<SearchResponse>, StatusCode> {
    let (documents, total) = state
        .db
        .search_documents(auth_user.user.id, search_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = SearchResponse {
        documents: documents.into_iter().map(|doc| doc.into()).collect(),
        total,
    };

    Ok(Json(response))
}
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Router,
};
use std::sync::Arc;
use utoipa::path;

use crate::{
    auth::AuthUser,
    models::{SearchRequest, SearchResponse, EnhancedDocumentResponse},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(search_documents))
        .route("/enhanced", get(enhanced_search_documents))
}

#[utoipa::path(
    get,
    path = "/api/search",
    tag = "search",
    security(
        ("bearer_auth" = [])
    ),
    params(
        SearchRequest
    ),
    responses(
        (status = 200, description = "Search results", body = SearchResponse),
        (status = 401, description = "Unauthorized")
    )
)]
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
        documents: documents.into_iter().map(|doc| EnhancedDocumentResponse {
            id: doc.id,
            filename: doc.filename,
            original_filename: doc.original_filename,
            file_size: doc.file_size,
            mime_type: doc.mime_type,
            tags: doc.tags,
            created_at: doc.created_at,
            has_ocr_text: doc.ocr_text.is_some(),
            search_rank: None,
            snippets: Vec::new(),
        }).collect(),
        total,
        query_time_ms: 0,
        suggestions: Vec::new(),
    };

    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/api/search/enhanced",
    tag = "search",
    security(
        ("bearer_auth" = [])
    ),
    params(
        SearchRequest
    ),
    responses(
        (status = 200, description = "Enhanced search results with snippets and suggestions", body = SearchResponse),
        (status = 401, description = "Unauthorized")
    )
)]
async fn enhanced_search_documents(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Query(search_request): Query<SearchRequest>,
) -> Result<Json<SearchResponse>, StatusCode> {
    // Generate suggestions before moving search_request
    let suggestions = generate_search_suggestions(&search_request.query);
    
    let (documents, total, query_time) = state
        .db
        .enhanced_search_documents(auth_user.user.id, search_request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let response = SearchResponse {
        documents,
        total,
        query_time_ms: query_time,
        suggestions,
    };

    Ok(Json(response))
}

fn generate_search_suggestions(query: &str) -> Vec<String> {
    // Simple suggestion generation - could be enhanced with a proper suggestion system
    let mut suggestions = Vec::new();
    
    if query.len() > 3 {
        // Common search variations
        suggestions.push(format!("\"{}\"", query)); // Exact phrase
        
        // Add wildcard suggestions
        if !query.contains('*') {
            suggestions.push(format!("{}*", query));
        }
        
        // Add similar terms (this would typically come from a thesaurus or ML model)
        if query.contains("document") {
            suggestions.push(query.replace("document", "file"));
            suggestions.push(query.replace("document", "paper"));
        }
    }
    
    suggestions.into_iter().take(3).collect()
}
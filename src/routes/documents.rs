use axum::{
    extract::{Multipart, Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::Deserialize;
use std::sync::Arc;
use tokio::spawn;

use crate::{
    auth::AuthUser,
    file_service::FileService,
    models::DocumentResponse,
    ocr::OcrService,
    AppState,
};

#[derive(Deserialize)]
struct PaginationQuery {
    limit: Option<i64>,
    offset: Option<i64>,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", post(upload_document))
        .route("/", get(list_documents))
        .route("/:id/download", get(download_document))
}

async fn upload_document(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    mut multipart: Multipart,
) -> Result<Json<DocumentResponse>, StatusCode> {
    let file_service = FileService::new(state.config.upload_path.clone());
    
    while let Some(field) = multipart.next_field().await.map_err(|_| StatusCode::BAD_REQUEST)? {
        let name = field.name().unwrap_or("").to_string();
        
        if name == "file" {
            let filename = field
                .file_name()
                .ok_or(StatusCode::BAD_REQUEST)?
                .to_string();
            
            if !file_service.is_allowed_file_type(&filename, &state.config.allowed_file_types) {
                return Err(StatusCode::BAD_REQUEST);
            }
            
            let data = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
            let file_size = data.len() as i64;
            
            let mime_type = mime_guess::from_path(&filename)
                .first_or_octet_stream()
                .to_string();
            
            let file_path = file_service
                .save_file(&filename, &data)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            
            let document = file_service.create_document(
                &filename,
                &filename,
                &file_path,
                file_size,
                &mime_type,
                auth_user.user.id,
            );
            
            let saved_document = state
                .db
                .create_document(document)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            
            let document_id = saved_document.id;
            let db_clone = state.db.clone();
            let file_path_clone = file_path.clone();
            let mime_type_clone = mime_type.clone();
            
            spawn(async move {
                let ocr_service = OcrService::new();
                if let Ok(text) = ocr_service.extract_text(&file_path_clone, &mime_type_clone).await {
                    if !text.is_empty() {
                        let _ = db_clone.update_document_ocr(document_id, &text).await;
                    }
                }
            });
            
            return Ok(Json(saved_document.into()));
        }
    }
    
    Err(StatusCode::BAD_REQUEST)
}

async fn list_documents(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Query(pagination): Query<PaginationQuery>,
) -> Result<Json<Vec<DocumentResponse>>, StatusCode> {
    let limit = pagination.limit.unwrap_or(50);
    let offset = pagination.offset.unwrap_or(0);
    
    let documents = state
        .db
        .get_documents_by_user(auth_user.user.id, limit, offset)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let response: Vec<DocumentResponse> = documents.into_iter().map(|doc| doc.into()).collect();
    
    Ok(Json(response))
}

async fn download_document(
    State(state): State<Arc<AppState>>,
    auth_user: AuthUser,
    Path(document_id): Path<uuid::Uuid>,
) -> Result<Vec<u8>, StatusCode> {
    let documents = state
        .db
        .get_documents_by_user(auth_user.user.id, 1000, 0)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let document = documents
        .into_iter()
        .find(|doc| doc.id == document_id)
        .ok_or(StatusCode::NOT_FOUND)?;
    
    let file_service = FileService::new(state.config.upload_path.clone());
    let file_data = file_service
        .read_file(&document.file_path)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    Ok(file_data)
}
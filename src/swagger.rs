use utoipa::{OpenApi, Modify};
use utoipa::openapi::security::{SecurityScheme, HttpAuthScheme, Http};
use utoipa_swagger_ui::SwaggerUi;
use axum::Router;
use std::sync::Arc;

use crate::{
    models::{
        CreateUser, LoginRequest, LoginResponse, UserResponse, UpdateUser,
        DocumentResponse, SearchRequest, SearchResponse, EnhancedDocumentResponse,
        SettingsResponse, UpdateSettings, SearchMode, SearchSnippet, HighlightRange
    },
    routes::metrics::{
        SystemMetrics, DatabaseMetrics, OcrMetrics, DocumentMetrics, UserMetrics, GeneralSystemMetrics
    },
    AppState,
};

#[derive(OpenApi)]
#[openapi(
    paths(
        // Auth endpoints
        crate::routes::auth::register,
        crate::routes::auth::login,
        crate::routes::auth::me,
        // Document endpoints
        crate::routes::documents::upload_document,
        crate::routes::documents::list_documents,
        crate::routes::documents::download_document,
        // Search endpoints
        crate::routes::search::search_documents,
        crate::routes::search::enhanced_search_documents,
        // Settings endpoints
        crate::routes::settings::get_settings,
        crate::routes::settings::update_settings,
        // User endpoints
        crate::routes::users::list_users,
        crate::routes::users::create_user,
        crate::routes::users::get_user,
        crate::routes::users::update_user,
        crate::routes::users::delete_user,
        // Queue endpoints
        crate::routes::queue::get_queue_stats,
        crate::routes::queue::requeue_failed,
        // Metrics endpoints
        crate::routes::metrics::get_system_metrics,
    ),
    components(
        schemas(
            CreateUser, LoginRequest, LoginResponse, UserResponse, UpdateUser,
            DocumentResponse, SearchRequest, SearchResponse, EnhancedDocumentResponse,
            SettingsResponse, UpdateSettings, SearchMode, SearchSnippet, HighlightRange,
            SystemMetrics, DatabaseMetrics, OcrMetrics, DocumentMetrics, UserMetrics, GeneralSystemMetrics
        )
    ),
    tags(
        (name = "auth", description = "Authentication endpoints"),
        (name = "documents", description = "Document management endpoints"),
        (name = "search", description = "Document search endpoints"),
        (name = "settings", description = "User settings endpoints"),
        (name = "users", description = "User management endpoints"),
        (name = "queue", description = "OCR queue management endpoints"),
        (name = "metrics", description = "System metrics and monitoring endpoints"),
    ),
    modifiers(&SecurityAddon),
    info(
        title = "Readur API",
        version = "0.1.0",
        description = "Document management and OCR processing API",
        contact(
            name = "Readur Team",
            email = "support@readur.dev"
        )
    ),
    servers(
        (url = "/api", description = "API base path")
    )
)]
pub struct ApiDoc;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer_auth",
                SecurityScheme::Http(Http::new(HttpAuthScheme::Bearer))
            )
        }
    }
}

pub fn create_swagger_router() -> Router<Arc<AppState>> {
    SwaggerUi::new("/swagger-ui")
        .url("/api-docs/openapi.json", ApiDoc::openapi())
        .into()
}
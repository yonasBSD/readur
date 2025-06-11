use anyhow::Result;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use tokio::sync::mpsc;
use tracing::{error, info};

use crate::{config::Config, db::Database, file_service::FileService, ocr::OcrService};

pub async fn start_folder_watcher(config: Config) -> Result<()> {
    let (tx, mut rx) = mpsc::channel(100);
    
    let mut watcher = RecommendedWatcher::new(
        move |res| {
            if let Err(e) = tx.blocking_send(res) {
                error!("Failed to send file event: {}", e);
            }
        },
        notify::Config::default(),
    )?;

    watcher.watch(Path::new(&config.watch_folder), RecursiveMode::Recursive)?;
    
    info!("Starting folder watcher on: {}", config.watch_folder);
    
    let db = Database::new(&config.database_url).await?;
    let file_service = FileService::new(config.upload_path.clone());
    let ocr_service = OcrService::new();
    
    while let Some(res) = rx.recv().await {
        match res {
            Ok(event) => {
                for path in event.paths {
                    if let Err(e) = process_file(&path, &db, &file_service, &ocr_service, &config).await {
                        error!("Failed to process file {:?}: {}", path, e);
                    }
                }
            }
            Err(e) => error!("Watch error: {:?}", e),
        }
    }
    
    Ok(())
}

async fn process_file(
    path: &std::path::Path,
    db: &Database,
    file_service: &FileService,
    ocr_service: &OcrService,
    config: &Config,
) -> Result<()> {
    if !path.is_file() {
        return Ok(());
    }
    
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    
    if !file_service.is_allowed_file_type(&filename, &config.allowed_file_types) {
        return Ok(());
    }
    
    info!("Processing new file: {:?}", path);
    
    let file_data = tokio::fs::read(path).await?;
    let file_size = file_data.len() as i64;
    
    let mime_type = mime_guess::from_path(&filename)
        .first_or_octet_stream()
        .to_string();
    
    let file_path = file_service.save_file(&filename, &file_data).await?;
    
    let system_user_id = uuid::Uuid::parse_str("00000000-0000-0000-0000-000000000000")?;
    
    let mut document = file_service.create_document(
        &filename,
        &filename,
        &file_path,
        file_size,
        &mime_type,
        system_user_id,
    );
    
    if let Ok(text) = ocr_service.extract_text(&file_path, &mime_type).await {
        if !text.is_empty() {
            document.ocr_text = Some(text);
        }
    }
    
    db.create_document(document).await?;
    
    info!("Successfully processed file: {}", filename);
    
    Ok(())
}
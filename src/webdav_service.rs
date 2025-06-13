use anyhow::{anyhow, Result};
use chrono::{DateTime, Utc};
use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::time::Duration;
use tracing::{debug, error, info, warn};

use crate::models::{
    WebDAVConnectionResult, WebDAVCrawlEstimate, WebDAVFolderInfo,
    WebDAVSyncStatus, WebDAVTestConnection,
};

#[derive(Debug, Clone)]
pub struct WebDAVConfig {
    pub server_url: String,
    pub username: String,
    pub password: String,
    pub watch_folders: Vec<String>,
    pub file_extensions: Vec<String>,
    pub timeout_seconds: u64,
    pub server_type: Option<String>, // "nextcloud", "owncloud", "generic"
}

#[derive(Debug, Serialize, Deserialize)]
struct WebDAVResponse {
    #[serde(rename = "d:multistatus")]
    multistatus: MultiStatus,
}

#[derive(Debug, Serialize, Deserialize)]
struct MultiStatus {
    #[serde(rename = "d:response")]
    responses: Vec<DAVResponse>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DAVResponse {
    #[serde(rename = "d:href")]
    href: String,
    #[serde(rename = "d:propstat")]
    propstat: PropStat,
}

#[derive(Debug, Serialize, Deserialize)]
struct PropStat {
    #[serde(rename = "d:prop")]
    prop: DAVProperties,
    #[serde(rename = "d:status")]
    status: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct DAVProperties {
    #[serde(rename = "d:displayname")]
    displayname: Option<String>,
    #[serde(rename = "d:getcontentlength")]
    contentlength: Option<String>,
    #[serde(rename = "d:getlastmodified")]
    lastmodified: Option<String>,
    #[serde(rename = "d:getcontenttype")]
    contenttype: Option<String>,
    #[serde(rename = "d:getetag")]
    etag: Option<String>,
    #[serde(rename = "d:resourcetype")]
    resourcetype: Option<ResourceType>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ResourceType {
    #[serde(rename = "d:collection")]
    collection: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub size: i64,
    pub mime_type: String,
    pub last_modified: Option<DateTime<Utc>>,
    pub etag: String,
    pub is_directory: bool,
}

pub struct WebDAVService {
    client: Client,
    config: WebDAVConfig,
    base_webdav_url: String,
}

impl WebDAVService {
    pub fn new(config: WebDAVConfig) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(config.timeout_seconds))
            .build()?;

        // Construct WebDAV URL based on server type
        let base_webdav_url = match config.server_type.as_deref() {
            Some("nextcloud") | Some("owncloud") => format!(
                "{}/remote.php/dav/files/{}",
                config.server_url.trim_end_matches('/'),
                config.username
            ),
            _ => format!(
                "{}/webdav",
                config.server_url.trim_end_matches('/')
            ),
        };

        Ok(Self {
            client,
            config,
            base_webdav_url,
        })
    }

    pub async fn test_connection(&self, test_config: WebDAVTestConnection) -> Result<WebDAVConnectionResult> {
        info!("Testing WebDAV connection to {} ({})", 
            test_config.server_url, 
            test_config.server_type.as_deref().unwrap_or("generic"));
        
        let test_url = match test_config.server_type.as_deref() {
            Some("nextcloud") | Some("owncloud") => format!(
                "{}/remote.php/dav/files/{}/",
                test_config.server_url.trim_end_matches('/'),
                test_config.username
            ),
            _ => format!(
                "{}/webdav/",
                test_config.server_url.trim_end_matches('/')
            ),
        };

        let response = self.client
            .request(Method::from_bytes(b"PROPFIND").unwrap(), &test_url)
            .basic_auth(&test_config.username, Some(&test_config.password))
            .header("Depth", "0")
            .body(r#"<?xml version="1.0"?>
                <d:propfind xmlns:d="DAV:">
                    <d:prop>
                        <d:displayname/>
                    </d:prop>
                </d:propfind>"#)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    info!("✅ WebDAV connection successful");
                    
                    // Try to get server info
                    let (version, server_type) = self.get_server_info(&test_config).await;
                    
                    Ok(WebDAVConnectionResult {
                        success: true,
                        message: format!("Successfully connected to WebDAV server ({})", 
                            server_type.as_deref().unwrap_or("Generic WebDAV")),
                        server_version: version,
                        server_type,
                    })
                } else {
                    error!("❌ WebDAV connection failed with status: {}", resp.status());
                    Ok(WebDAVConnectionResult {
                        success: false,
                        message: format!("Connection failed: HTTP {}", resp.status()),
                        server_version: None,
                        server_type: None,
                    })
                }
            }
            Err(e) => {
                error!("❌ WebDAV connection error: {}", e);
                Ok(WebDAVConnectionResult {
                    success: false,
                    message: format!("Connection error: {}", e),
                    server_version: None,
                    server_type: None,
                })
            }
        }
    }

    async fn get_server_info(&self, test_config: &WebDAVTestConnection) -> (Option<String>, Option<String>) {
        // Try Nextcloud/ownCloud capabilities first
        if let Some(server_type) = &test_config.server_type {
            if server_type == "nextcloud" || server_type == "owncloud" {
                let capabilities_url = format!(
                    "{}/ocs/v1.php/cloud/capabilities?format=json",
                    test_config.server_url.trim_end_matches('/')
                );

                if let Ok(response) = self.client
                    .get(&capabilities_url)
                    .basic_auth(&test_config.username, Some(&test_config.password))
                    .send()
                    .await 
                {
                    if response.status().is_success() {
                        if let Ok(text) = response.text().await {
                            // Simple version extraction
                            if let Some(start) = text.find("\"version\":\"") {
                                let version_start = start + 11;
                                if let Some(end) = text[version_start..].find('"') {
                                    let version = text[version_start..version_start + end].to_string();
                                    return (Some(version), Some(server_type.clone()));
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // Fallback: try to detect server type from headers
        (Some("Unknown".to_string()), test_config.server_type.clone())
    }

    pub async fn estimate_crawl(&self, folders: &[String]) -> Result<WebDAVCrawlEstimate> {
        info!("Estimating crawl for {} folders", folders.len());
        
        let mut folder_infos = Vec::new();
        let supported_extensions: HashSet<String> = self.config.file_extensions
            .iter()
            .map(|ext| ext.to_lowercase())
            .collect();

        for folder_path in folders {
            info!("Analyzing folder: {}", folder_path);
            
            match self.analyze_folder(folder_path, &supported_extensions).await {
                Ok(folder_info) => {
                    debug!("Folder {} has {} files ({} supported)", 
                        folder_path, folder_info.total_files, folder_info.supported_files);
                    folder_infos.push(folder_info);
                }
                Err(e) => {
                    warn!("Failed to analyze folder {}: {}", folder_path, e);
                    // Add empty folder info so UI can show the error
                    folder_infos.push(WebDAVFolderInfo {
                        path: folder_path.clone(),
                        total_files: 0,
                        supported_files: 0,
                        estimated_time_hours: 0.0,
                        total_size_mb: 0.0,
                    });
                }
            }
        }

        let total_files: i64 = folder_infos.iter().map(|f| f.total_files).sum();
        let total_supported_files: i64 = folder_infos.iter().map(|f| f.supported_files).sum();
        let total_estimated_time_hours: f32 = folder_infos.iter().map(|f| f.estimated_time_hours).sum();
        let total_size_mb: f64 = folder_infos.iter().map(|f| f.total_size_mb).sum();

        info!("Crawl estimate complete: {} total files, {} supported files, {:.2} hours estimated", 
            total_files, total_supported_files, total_estimated_time_hours);

        Ok(WebDAVCrawlEstimate {
            folders: folder_infos,
            total_files,
            total_supported_files,
            total_estimated_time_hours,
            total_size_mb,
        })
    }

    async fn analyze_folder(&self, folder_path: &str, supported_extensions: &HashSet<String>) -> Result<WebDAVFolderInfo> {
        let files = self.discover_files_in_folder(folder_path).await?;
        
        let mut total_files = 0i64;
        let mut supported_files = 0i64;
        let mut total_size_bytes = 0i64;

        for file in files {
            if !file.is_directory {
                total_files += 1;
                total_size_bytes += file.size;

                // Check if file extension is supported
                if let Some(extension) = std::path::Path::new(&file.name)
                    .extension()
                    .and_then(|ext| ext.to_str())
                {
                    if supported_extensions.contains(&extension.to_lowercase()) {
                        supported_files += 1;
                    }
                }
            }
        }

        // Estimate processing time: ~2 seconds per file for OCR
        // This is a rough estimate - actual time depends on file size and complexity
        let estimated_time_hours = (supported_files as f32 * 2.0) / 3600.0;
        let total_size_mb = total_size_bytes as f64 / (1024.0 * 1024.0);

        Ok(WebDAVFolderInfo {
            path: folder_path.to_string(),
            total_files,
            supported_files,
            estimated_time_hours,
            total_size_mb,
        })
    }

    async fn discover_files_in_folder(&self, folder_path: &str) -> Result<Vec<FileInfo>> {
        let folder_url = format!("{}{}", self.base_webdav_url, folder_path);
        
        debug!("Discovering files in: {}", folder_url);

        let propfind_body = r#"<?xml version="1.0"?>
            <d:propfind xmlns:d="DAV:">
                <d:prop>
                    <d:displayname/>
                    <d:getcontentlength/>
                    <d:getlastmodified/>
                    <d:getcontenttype/>
                    <d:getetag/>
                    <d:resourcetype/>
                </d:prop>
            </d:propfind>"#;

        let response = self.client
            .request(Method::from_bytes(b"PROPFIND").unwrap(), &folder_url)
            .basic_auth(&self.config.username, Some(&self.config.password))
            .header("Depth", "infinity")  // Get all files recursively
            .header("Content-Type", "application/xml")
            .body(propfind_body)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("PROPFIND request failed: {}", response.status()));
        }

        let response_text = response.text().await?;
        debug!("WebDAV response received, parsing...");

        self.parse_webdav_response(&response_text)
    }

    pub fn parse_webdav_response(&self, xml_text: &str) -> Result<Vec<FileInfo>> {
        // For now, we'll do simple string parsing
        // In a production system, you'd want to use a proper XML parser like quick-xml
        let mut files = Vec::new();
        
        // This is a simplified parser - in practice you'd want proper XML parsing
        let lines: Vec<&str> = xml_text.lines().collect();
        let mut current_file: Option<FileInfo> = None;
        let mut in_response = false;
        
        for line in lines {
            let line = line.trim();
            
            if line.contains("<d:response>") {
                in_response = true;
                current_file = Some(FileInfo {
                    path: String::new(),
                    name: String::new(),
                    size: 0,
                    mime_type: String::new(),
                    last_modified: None,
                    etag: String::new(),
                    is_directory: false,
                });
            } else if line.contains("</d:response>") && in_response {
                if let Some(file) = current_file.take() {
                    if !file.path.is_empty() && !file.path.ends_with('/') {
                        files.push(file);
                    }
                }
                in_response = false;
            } else if in_response {
                if let Some(ref mut file) = current_file {
                    if line.contains("<d:href>") {
                        if let Some(start) = line.find("<d:href>") {
                            if let Some(end) = line.find("</d:href>") {
                                let href = &line[start + 8..end];
                                file.path = href.to_string();
                                file.name = href.split('/').last().unwrap_or("").to_string();
                            }
                        }
                    } else if line.contains("<d:getcontentlength>") {
                        if let Some(start) = line.find("<d:getcontentlength>") {
                            if let Some(end) = line.find("</d:getcontentlength>") {
                                if let Ok(size) = line[start + 20..end].parse::<i64>() {
                                    file.size = size;
                                }
                            }
                        }
                    } else if line.contains("<d:getcontenttype>") {
                        if let Some(start) = line.find("<d:getcontenttype>") {
                            if let Some(end) = line.find("</d:getcontenttype>") {
                                file.mime_type = line[start + 18..end].to_string();
                            }
                        }
                    } else if line.contains("<d:getetag>") {
                        if let Some(start) = line.find("<d:getetag>") {
                            if let Some(end) = line.find("</d:getetag>") {
                                file.etag = line[start + 11..end].to_string();
                            }
                        }
                    } else if line.contains("<d:collection") {
                        file.is_directory = true;
                    }
                }
            }
        }

        info!("Parsed {} files from WebDAV response", files.len());
        Ok(files)
    }

    pub async fn download_file(&self, file_path: &str) -> Result<Vec<u8>> {
        let file_url = format!("{}{}", self.base_webdav_url, file_path);
        
        debug!("Downloading file: {}", file_url);

        let response = self.client
            .get(&file_url)
            .basic_auth(&self.config.username, Some(&self.config.password))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow!("File download failed: {}", response.status()));
        }

        let bytes = response.bytes().await?;
        debug!("Downloaded {} bytes", bytes.len());
        
        Ok(bytes.to_vec())
    }

    pub async fn get_sync_status(&self) -> Result<WebDAVSyncStatus> {
        // This would typically read from database/cache
        // For now, return a placeholder
        Ok(WebDAVSyncStatus {
            is_running: false,
            last_sync: None,
            files_processed: 0,
            files_remaining: 0,
            current_folder: None,
            errors: Vec::new(),
        })
    }
}
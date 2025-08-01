use anyhow::Result;
use std::sync::Arc;
use uuid::Uuid;
use tokio;
use futures::future::join_all;
use readur::{
    models::{CreateWebDAVDirectory, CreateUser, UserRole},
    test_utils::TestContext,
};

#[tokio::test]
async fn test_bulk_create_or_update_atomic() {
    let ctx = TestContext::new().await;
        
        // Ensure cleanup happens even if test fails
        let result: Result<()> = async {
        let db = &ctx.state.db;

        // Create a test user first
        let create_user = CreateUser {
            username: "testuser".to_string(),
            email: "test@example.com".to_string(),
            password: "password123".to_string(),
            role: Some(UserRole::User),
        };
        let user = db.create_user(create_user).await
            .expect("Failed to create test user");
        let user_id = user.id;

        let directories = vec![
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir1".to_string(),
                directory_etag: "etag1".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir2".to_string(),
                directory_etag: "etag2".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir3".to_string(),
                directory_etag: "etag3".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
        ];

        // Test bulk operation
        let result = db.bulk_create_or_update_webdav_directories(&directories).await;
        if let Err(e) = &result {
            eprintln!("Error in bulk_create_or_update_webdav_directories: {}", e);
        }
        assert!(result.is_ok());

        let saved_directories = result.unwrap();
        assert_eq!(saved_directories.len(), 3);

        // Verify all directories were saved with correct ETags
        for (original, saved) in directories.iter().zip(saved_directories.iter()) {
            assert_eq!(original.directory_path, saved.directory_path);
            assert_eq!(original.directory_etag, saved.directory_etag);
            assert_eq!(original.user_id, saved.user_id);
        }
            
            Ok(())
        }.await;
        
        // Always cleanup database connections and test data
        if let Err(e) = ctx.cleanup_and_close().await {
            eprintln!("Warning: Test cleanup failed: {}", e);
        }
        
        result.unwrap();
    }

#[tokio::test]
async fn test_sync_webdav_directories_atomic() {
    let ctx = TestContext::new().await;
        
        // Ensure cleanup happens even if test fails
        let result: Result<()> = async {
        let db = &ctx.state.db;

        // Create a test user first
        let create_user = CreateUser {
            username: "testuser2".to_string(),
            email: "test2@example.com".to_string(),
            password: "password123".to_string(),
            role: Some(UserRole::User),
        };
        let user = db.create_user(create_user).await
            .expect("Failed to create test user");
        let user_id = user.id;

        // First, create some initial directories
        let initial_directories = vec![
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir1".to_string(),
                directory_etag: "etag1".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir2".to_string(),
                directory_etag: "etag2".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
        ];

        let _ = db.bulk_create_or_update_webdav_directories(&initial_directories).await.unwrap();

        // Now sync with a new set that has one update, one delete, and one new
        let sync_directories = vec![
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir1".to_string(),
                directory_etag: "etag1_updated".to_string(), // Updated
                file_count: 5,
                total_size_bytes: 1024,
            },
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir3".to_string(), // New
                directory_etag: "etag3".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
            // dir2 is missing, should be deleted
        ];

        let result = db.sync_webdav_directories(user_id, &sync_directories).await;
        assert!(result.is_ok());

        let (updated_directories, deleted_count) = result.unwrap();

        // Should have 2 directories (dir1 updated, dir3 new)
        assert_eq!(updated_directories.len(), 2);

        // Should have deleted 1 directory (dir2)
        assert_eq!(deleted_count, 1);

        // Verify the updated directory has the new ETag
        let dir1 = updated_directories.iter()
            .find(|d| d.directory_path == "/test/dir1")
            .unwrap();
        assert_eq!(dir1.directory_etag, "etag1_updated");
        assert_eq!(dir1.file_count, 5);
        assert_eq!(dir1.total_size_bytes, 1024);

        // Verify the new directory exists
        let dir3 = updated_directories.iter()
            .find(|d| d.directory_path == "/test/dir3")
            .unwrap();
        assert_eq!(dir3.directory_etag, "etag3");
            
            Ok(())
        }.await;
        
        // Always cleanup database connections and test data
        if let Err(e) = ctx.cleanup_and_close().await {
            eprintln!("Warning: Test cleanup failed: {}", e);
        }
        
        result.unwrap();
    }

#[tokio::test]
async fn test_delete_missing_directories() {
    let ctx = TestContext::new().await;
        
        // Ensure cleanup happens even if test fails
        let result: Result<()> = async {
        let db = &ctx.state.db;

        // Create a test user first
        let create_user = CreateUser {
            username: "testuser3".to_string(),
            email: "test3@example.com".to_string(),
            password: "password123".to_string(),
            role: Some(UserRole::User),
        };
        let user = db.create_user(create_user).await
            .expect("Failed to create test user");
        let user_id = user.id;

        // Create some directories
        let directories = vec![
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir1".to_string(),
                directory_etag: "etag1".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir2".to_string(),
                directory_etag: "etag2".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir3".to_string(),
                directory_etag: "etag3".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
        ];

        let _ = db.bulk_create_or_update_webdav_directories(&directories).await.unwrap();

        // Delete directories not in this list (should delete dir2 and dir3)
        let existing_paths = vec!["/test/dir1".to_string()];
        let deleted_count = db.delete_missing_webdav_directories(user_id, &existing_paths).await.unwrap();

        assert_eq!(deleted_count, 2);

        // Verify only dir1 remains
        let remaining_directories = db.list_webdav_directories(user_id).await.unwrap();
        assert_eq!(remaining_directories.len(), 1);
        assert_eq!(remaining_directories[0].directory_path, "/test/dir1");
            
            Ok(())
        }.await;
        
        // Always cleanup database connections and test data
        if let Err(e) = ctx.cleanup_and_close().await {
            eprintln!("Warning: Test cleanup failed: {}", e);
        }
        
        result.unwrap();
    }

#[tokio::test]
async fn test_atomic_rollback_on_failure() {
    let ctx = TestContext::new().await;
        
        // Ensure cleanup happens even if test fails
        let result: Result<()> = async {
        let db = &ctx.state.db;

        // Create a test user first
        let create_user = CreateUser {
            username: "testuser4".to_string(),
            email: "test4@example.com".to_string(),
            password: "password123".to_string(),
            role: Some(UserRole::User),
        };
        let user = db.create_user(create_user).await
            .expect("Failed to create test user");
        let user_id = user.id;

        // Create a directory that would conflict
        let initial_dir = CreateWebDAVDirectory {
            user_id,
            directory_path: "/test/dir1".to_string(),
            directory_etag: "etag1".to_string(),
            file_count: 0,
            total_size_bytes: 0,
        };

        let _ = db.create_or_update_webdav_directory(&initial_dir).await.unwrap();

        // Try to bulk insert with one invalid entry that should cause rollback
        let directories_with_invalid = vec![
            CreateWebDAVDirectory {
                user_id,
                directory_path: "/test/dir2".to_string(),
                directory_etag: "etag2".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
            CreateWebDAVDirectory {
                user_id: Uuid::nil(), // Invalid user ID should cause failure
                directory_path: "/test/dir3".to_string(),
                directory_etag: "etag3".to_string(),
                file_count: 0,
                total_size_bytes: 0,
            },
        ];

        // This should fail and rollback
        let result = db.bulk_create_or_update_webdav_directories(&directories_with_invalid).await;
        assert!(result.is_err());

        // Verify that no partial changes were made (only original dir1 should exist)
        let directories = db.list_webdav_directories(user_id).await.unwrap();
        assert_eq!(directories.len(), 1);
        assert_eq!(directories[0].directory_path, "/test/dir1");
            
            Ok(())
        }.await;
        
        // Always cleanup database connections and test data
        if let Err(e) = ctx.cleanup_and_close().await {
            eprintln!("Warning: Test cleanup failed: {}", e);
        }
        
        result.unwrap();
    }

#[tokio::test]
async fn test_concurrent_directory_updates() {
    let ctx = TestContext::new().await;
        
        // Ensure cleanup happens even if test fails
        let result: Result<()> = async {
        let db = Arc::new(ctx.state.db.clone());

        // Create a test user first
        let create_user = CreateUser {
            username: "testuser5".to_string(),
            email: "test5@example.com".to_string(),
            password: "password123".to_string(),
            role: Some(UserRole::User),
        };
        let user = db.create_user(create_user).await
            .expect("Failed to create test user");
        let user_id = user.id;

        // Spawn multiple concurrent tasks that try to update the same directory
        let mut handles = vec![];

        for i in 0..10 {
            let db_clone = db.clone();
            let handle = tokio::spawn(async move {
                let directory = CreateWebDAVDirectory {
                    user_id,
                    directory_path: "/test/concurrent".to_string(),
                    directory_etag: format!("etag_{}", i),
                    file_count: i as i64,
                    total_size_bytes: (i * 1024) as i64,
                };

                db_clone.create_or_update_webdav_directory(&directory).await
            });
            handles.push(handle);
        }

        // Wait for all tasks to complete
        let results: Vec<_> = join_all(handles).await;

        // All operations should succeed (last writer wins)
        for result in results {
            assert!(result.is_ok());
            assert!(result.unwrap().is_ok());
        }

        // Verify final state
        let directories = db.list_webdav_directories(user_id).await.unwrap();
        assert_eq!(directories.len(), 1);
        assert_eq!(directories[0].directory_path, "/test/concurrent");
        // ETag should be from one of the concurrent updates
        assert!(directories[0].directory_etag.starts_with("etag_"));
            
            Ok(())
        }.await;
        
        // Always cleanup database connections and test data
        if let Err(e) = ctx.cleanup_and_close().await {
            eprintln!("Warning: Test cleanup failed: {}", e);
        }
        
        result.unwrap();
    }
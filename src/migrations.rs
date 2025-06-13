use anyhow::Result;
use sqlx::PgPool;
use tracing::{info, warn, error};
use std::fs;
use std::path::Path;

pub struct MigrationRunner {
    pool: PgPool,
    migrations_dir: String,
}

#[derive(Debug)]
pub struct Migration {
    pub version: i32,
    pub name: String,
    pub sql: String,
}

impl MigrationRunner {
    pub fn new(pool: PgPool, migrations_dir: String) -> Self {
        Self {
            pool,
            migrations_dir,
        }
    }

    /// Initialize the migrations table if it doesn't exist
    pub async fn init(&self) -> Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            );
            "#
        )
        .execute(&self.pool)
        .await?;

        info!("Migration system initialized");
        Ok(())
    }

    /// Load all migration files from the migrations directory
    pub fn load_migrations(&self) -> Result<Vec<Migration>> {
        let mut migrations = Vec::new();
        let migrations_path = Path::new(&self.migrations_dir);

        if !migrations_path.exists() {
            warn!("Migrations directory not found: {}", self.migrations_dir);
            return Ok(migrations);
        }

        let mut entries: Vec<_> = fs::read_dir(migrations_path)?
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                entry.path().extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s == "sql")
                    .unwrap_or(false)
            })
            .collect();

        // Sort by filename to ensure proper order
        entries.sort_by(|a, b| a.file_name().cmp(&b.file_name()));

        for entry in entries {
            let filename = entry.file_name().to_string_lossy().to_string();
            
            // Parse version from filename (e.g., "001_add_ocr_queue.sql" -> version 1)
            if let Some(version_str) = filename.split('_').next() {
                if let Ok(version) = version_str.parse::<i32>() {
                    let sql = fs::read_to_string(entry.path())?;
                    let name = filename.replace(".sql", "");
                    
                    migrations.push(Migration {
                        version,
                        name,
                        sql,
                    });
                }
            }
        }

        migrations.sort_by_key(|m| m.version);
        Ok(migrations)
    }

    /// Get the list of applied migration versions
    pub async fn get_applied_migrations(&self) -> Result<Vec<i32>> {
        let rows = sqlx::query_scalar::<_, i32>("SELECT version FROM schema_migrations ORDER BY version")
            .fetch_all(&self.pool)
            .await?;
        Ok(rows)
    }

    /// Check if a specific migration has been applied
    pub async fn is_migration_applied(&self, version: i32) -> Result<bool> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = $1"
        )
        .bind(version)
        .fetch_one(&self.pool)
        .await?;
        
        Ok(count > 0)
    }

    /// Apply a single migration
    pub async fn apply_migration(&self, migration: &Migration) -> Result<()> {
        info!("Applying migration {}: {}", migration.version, migration.name);

        // Start a transaction
        let mut tx = self.pool.begin().await?;

        // Split SQL into individual statements and execute each one
        let statements = self.split_sql_statements(&migration.sql);
        
        for (i, statement) in statements.iter().enumerate() {
            if statement.trim().is_empty() {
                continue;
            }
            
            sqlx::query(statement)
                .execute(&mut *tx)
                .await
                .map_err(|e| {
                    error!("Failed to apply migration {} statement {}: {}\nStatement: {}", 
                           migration.version, i + 1, e, statement);
                    e
                })?;
        }

        // Record the migration as applied
        sqlx::query(
            "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)"
        )
        .bind(migration.version)
        .bind(&migration.name)
        .execute(&mut *tx)
        .await?;

        // Commit the transaction
        tx.commit().await?;

        info!("Successfully applied migration {}: {}", migration.version, migration.name);
        Ok(())
    }

    /// Split SQL content into individual statements
    fn split_sql_statements(&self, sql: &str) -> Vec<String> {
        let mut statements = Vec::new();
        let mut current_statement = String::new();
        let mut in_function = false;
        let mut function_depth = 0;
        
        for line in sql.lines() {
            let trimmed = line.trim();
            
            // Skip comments and empty lines
            if trimmed.is_empty() || trimmed.starts_with("--") {
                continue;
            }
            
            // Detect function definitions (PostgreSQL functions can contain semicolons)
            if trimmed.contains("CREATE OR REPLACE FUNCTION") || trimmed.contains("CREATE FUNCTION") {
                in_function = true;
                function_depth = 0;
            }
            
            current_statement.push_str(line);
            current_statement.push('\n');
            
            // Track function block depth
            if in_function {
                if trimmed.contains("BEGIN") {
                    function_depth += 1;
                }
                if trimmed.contains("END;") {
                    function_depth -= 1;
                    if function_depth <= 0 {
                        in_function = false;
                        statements.push(current_statement.trim().to_string());
                        current_statement.clear();
                        continue;
                    }
                }
            }
            
            // For non-function statements, split on semicolon
            if !in_function && trimmed.ends_with(';') {
                statements.push(current_statement.trim().to_string());
                current_statement.clear();
            }
        }
        
        // Add any remaining statement
        if !current_statement.trim().is_empty() {
            statements.push(current_statement.trim().to_string());
        }
        
        statements
    }

    /// Run all pending migrations
    pub async fn run_migrations(&self) -> Result<()> {
        // Initialize migration system
        self.init().await?;

        // Load all migrations
        let migrations = self.load_migrations()?;
        if migrations.is_empty() {
            info!("No migrations found");
            return Ok(());
        }

        // Get applied migrations
        let applied = self.get_applied_migrations().await?;
        
        // Find pending migrations
        let pending: Vec<&Migration> = migrations
            .iter()
            .filter(|m| !applied.contains(&m.version))
            .collect();

        if pending.is_empty() {
            info!("All migrations are up to date");
            return Ok(());
        }

        info!("Found {} pending migrations", pending.len());

        // Apply each pending migration
        for migration in pending {
            self.apply_migration(migration).await?;
        }

        info!("All migrations completed successfully");
        Ok(())
    }

    /// Get migration status summary
    pub async fn get_status(&self) -> Result<MigrationStatus> {
        self.init().await?;
        
        let migrations = self.load_migrations()?;
        let applied = self.get_applied_migrations().await?;
        
        let pending_count = migrations
            .iter()
            .filter(|m| !applied.contains(&m.version))
            .count();

        Ok(MigrationStatus {
            total_migrations: migrations.len(),
            applied_migrations: applied.len(),
            pending_migrations: pending_count,
            latest_version: migrations.last().map(|m| m.version),
            current_version: applied.last().copied(),
        })
    }
}

#[derive(Debug)]
pub struct MigrationStatus {
    pub total_migrations: usize,
    pub applied_migrations: usize,
    pub pending_migrations: usize,
    pub latest_version: Option<i32>,
    pub current_version: Option<i32>,
}

impl MigrationStatus {
    pub fn is_up_to_date(&self) -> bool {
        self.pending_migrations == 0
    }

    pub fn needs_migration(&self) -> bool {
        self.pending_migrations > 0
    }
}

/// Convenience function to run migrations at startup
pub async fn run_startup_migrations(database_url: &str, migrations_dir: &str) -> Result<()> {
    let pool = sqlx::PgPool::connect(database_url).await?;
    let runner = MigrationRunner::new(pool, migrations_dir.to_string());
    
    info!("Running database migrations...");
    runner.run_migrations().await?;
    
    Ok(())
}
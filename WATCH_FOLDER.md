# Watch Folder Documentation

The watch folder feature automatically monitors a directory for new OCR-able files and processes them without deleting the original files. This is perfect for scenarios where files are mounted from various filesystem types including NFS, SMB, S3, and local storage.

## Features

### 🔄 Cross-Filesystem Compatibility
- **Automatic Detection**: Detects filesystem type and chooses optimal watching strategy
- **Local Filesystems**: Uses efficient inotify-based watching for ext4, NTFS, APFS, etc.
- **Network Filesystems**: Uses polling-based watching for NFS, SMB/CIFS, S3 mounts
- **Hybrid Fallback**: Gracefully falls back to polling if inotify fails

### 📁 Smart File Processing
- **OCR-able File Detection**: Only processes supported file types (PDF, images, text, Word docs)
- **Duplicate Prevention**: Checks for existing files with same name and size
- **File Stability**: Waits for files to finish being written before processing
- **System File Exclusion**: Skips hidden files, temporary files, and system directories

### ⚙️ Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `WATCH_FOLDER` | `./watch` | Path to the folder to monitor |
| `WATCH_INTERVAL_SECONDS` | `30` | Polling interval for network filesystems |
| `FILE_STABILITY_CHECK_MS` | `500` | Time to wait for file stability |
| `MAX_FILE_AGE_HOURS` | `none` | Skip files older than specified hours |
| `ALLOWED_FILE_TYPES` | `pdf,png,jpg,jpeg,tiff,bmp,txt,doc,docx` | Allowed file extensions |
| `FORCE_POLLING_WATCH` | `unset` | Force polling mode even for local filesystems |

## Usage

### Basic Setup

1. **Set the watch folder path:**
   ```bash
   export WATCH_FOLDER=/path/to/your/mounted/folder
   ```

2. **Start the application:**
   ```bash
   ./readur
   ```

3. **Copy files to the watch folder:**
   The application will automatically detect and process new files.

### Docker Usage

```dockerfile
# Mount your folder to the container's watch directory
docker run -d \
  -v /path/to/your/files:/app/watch \
  -e WATCH_FOLDER=/app/watch \
  -e WATCH_INTERVAL_SECONDS=60 \
  readur:latest
```

### Docker Compose

```yaml
services:
  readur:
    image: readur:latest
    volumes:
      - /mnt/nfs/documents:/app/watch
      - readur_uploads:/app/uploads
    environment:
      WATCH_FOLDER: /app/watch
      WATCH_INTERVAL_SECONDS: 30
      FILE_STABILITY_CHECK_MS: 1000
      MAX_FILE_AGE_HOURS: 168  # 1 week
    ports:
      - "8000:8000"
```

## Filesystem-Specific Configuration

### NFS Mounts
```bash
# Recommended settings for NFS
export WATCH_INTERVAL_SECONDS=60
export FILE_STABILITY_CHECK_MS=1000
export FORCE_POLLING_WATCH=1
```

### SMB/CIFS Mounts
```bash
# Recommended settings for SMB
export WATCH_INTERVAL_SECONDS=30
export FILE_STABILITY_CHECK_MS=2000
```

### S3 Mounts (s3fs, goofys, etc.)
```bash
# Recommended settings for S3
export WATCH_INTERVAL_SECONDS=120
export FILE_STABILITY_CHECK_MS=5000
export FORCE_POLLING_WATCH=1
```

### Local Filesystems
```bash
# Optimal settings for local storage (default behavior)
# No special configuration needed - uses inotify automatically
```

## Supported File Types

The watch folder processes these file types for OCR:

- **PDF**: `*.pdf`
- **Images**: `*.png`, `*.jpg`, `*.jpeg`, `*.tiff`, `*.bmp`, `*.gif`
- **Text**: `*.txt`
- **Word Documents**: `*.doc`, `*.docx`

## File Processing Priority

Files are prioritized for OCR processing based on:

1. **File Size**: Smaller files get higher priority
2. **File Type**: Images > Text files > PDFs > Word documents
3. **Queue Time**: Older items get higher priority within the same size/type category

## Monitoring and Logs

The application provides detailed logging for watch folder operations:

```
INFO  readur::watcher: Starting hybrid folder watcher on: /app/watch
INFO  readur::watcher: Using watch strategy: Hybrid
INFO  readur::watcher: Started polling-based watcher on: /app/watch
INFO  readur::watcher: Processing new file: "/app/watch/document.pdf"
INFO  readur::watcher: Successfully queued file for OCR: document.pdf (size: 2048 bytes)
```

## Troubleshooting

### Files Not Being Detected

1. **Check permissions:**
   ```bash
   ls -la /path/to/watch/folder
   chmod 755 /path/to/watch/folder
   ```

2. **Verify file types:**
   ```bash
   # Only supported file types are processed
   echo $ALLOWED_FILE_TYPES
   ```

3. **Check file stability:**
   ```bash
   # Increase stability check time for slow networks
   export FILE_STABILITY_CHECK_MS=2000
   ```

### High CPU Usage

1. **Increase polling interval:**
   ```bash
   export WATCH_INTERVAL_SECONDS=120
   ```

2. **Limit file age:**
   ```bash
   export MAX_FILE_AGE_HOURS=24
   ```

### Network Mount Issues

1. **Force polling mode:**
   ```bash
   export FORCE_POLLING_WATCH=1
   ```

2. **Increase stability check:**
   ```bash
   export FILE_STABILITY_CHECK_MS=5000
   ```

## Testing

Use the provided test script to verify functionality:

```bash
./test_watch_folder.sh
```

This creates sample files in the watch folder for testing.

## Security Considerations

- Files are copied to a secure upload directory, not processed in-place
- Original files in the watch folder are never modified or deleted
- System files and hidden files are automatically excluded
- File size limits prevent processing of excessively large files (>500MB)

## Performance

- **Local filesystems**: Near-instant detection via inotify
- **Network filesystems**: Detection within polling interval (default 30s)
- **Concurrent processing**: Multiple files processed simultaneously
- **Memory efficient**: Streams large files without loading entirely into memory

## Examples

### Basic File Drop
```bash
# Copy a file to the watch folder
cp document.pdf /app/watch/
# File will be automatically detected and processed
```

### Batch Processing
```bash
# Copy multiple files
cp *.pdf /app/watch/
# All supported files will be queued for processing
```

### Real-time Monitoring
```bash
# Watch the logs for processing updates
docker logs -f readur-container | grep watcher
```
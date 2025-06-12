#!/bin/bash

# Test script for watch folder functionality
echo "Testing watch folder functionality..."

# Create a test watch folder if it doesn't exist
mkdir -p ./watch

echo "Creating test files in watch folder..."

# Create a test text file
echo "This is a test document for OCR processing." > ./watch/test_document.txt

# Create a test PDF file (mock content)
echo "%PDF-1.4 Mock PDF for testing" > ./watch/test_document.pdf

# Create a test image file (mock content)
echo "Mock PNG image content" > ./watch/test_image.png

echo "Test files created in ./watch/ folder:"
ls -la ./watch/

echo ""
echo "Watch folder setup complete!"
echo "You can now:"
echo "1. Start the readur application"
echo "2. Copy OCR-able files to the ./watch/ folder"
echo "3. Monitor the logs to see files being processed"
echo ""
echo "Supported file types: PDF, PNG, JPG, JPEG, TIFF, BMP, TXT, DOC, DOCX"
echo ""
echo "Environment variables for configuration:"
echo "- WATCH_FOLDER: Path to watch folder (default: ./watch)"
echo "- WATCH_INTERVAL_SECONDS: Polling interval (default: 30)"
echo "- FILE_STABILITY_CHECK_MS: File stability check time (default: 500)"
echo "- MAX_FILE_AGE_HOURS: Skip files older than this (default: none)"
echo "- FORCE_POLLING_WATCH: Force polling mode (default: auto-detect)"
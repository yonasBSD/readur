#!/bin/bash

# Apply database migrations for enhanced OCR
# Usage: ./apply_migrations.sh [database_url]

set -e

# Default database URL from environment or use provided argument
DATABASE_URL=${1:-${DATABASE_URL:-"postgresql://localhost/readur"}}

echo "Applying migrations to: $DATABASE_URL"

# Apply migration 002 if it hasn't been applied yet
echo "Checking if migration 002_add_enhanced_ocr_fields.sql needs to be applied..."

# Check if the new columns exist
COLUMNS_EXIST=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'documents' 
AND column_name IN ('ocr_confidence', 'ocr_word_count', 'ocr_processing_time_ms');
")

if [[ $COLUMNS_EXIST -eq 3 ]]; then
    echo "Enhanced OCR fields already exist. Migration already applied."
else
    echo "Applying migration 002_add_enhanced_ocr_fields.sql..."
    psql "$DATABASE_URL" -f migrations/002_add_enhanced_ocr_fields.sql
    echo "Migration 002 applied successfully!"
fi

# Verify the migration was successful
echo "Verifying migration..."
VERIFICATION=$(psql "$DATABASE_URL" -t -c "
SELECT 
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'ocr_confidence') as doc_cols,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'ocr_page_segmentation_mode') as settings_cols;
")

echo "Migration verification: $VERIFICATION"

if echo "$VERIFICATION" | grep -q "1.*1"; then
    echo "✅ Enhanced OCR migration completed successfully!"
    echo ""
    echo "New features available:"
    echo "- OCR confidence scoring and quality validation"
    echo "- Advanced image preprocessing for challenging images"
    echo "- Configurable Tesseract PSM and OEM settings"
    echo "- Intelligent brightness/contrast enhancement"
    echo "- Adaptive noise removal and sharpening"
    echo "- OCR analytics and monitoring"
    echo ""
    echo "You can now restart your Readur server to use the enhanced OCR features."
else
    echo "❌ Migration verification failed. Please check the logs above."
    exit 1
fi
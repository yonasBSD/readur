-- Add enhanced OCR metadata fields to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_confidence REAL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_word_count INT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_processing_time_ms INT;

-- Add enhanced OCR configuration fields to settings table
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ocr_page_segmentation_mode INT DEFAULT 3;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ocr_engine_mode INT DEFAULT 3;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ocr_min_confidence REAL DEFAULT 30.0;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ocr_dpi INT DEFAULT 300;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ocr_enhance_contrast BOOLEAN DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ocr_remove_noise BOOLEAN DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ocr_detect_orientation BOOLEAN DEFAULT true;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ocr_whitelist_chars TEXT;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS ocr_blacklist_chars TEXT;

-- Add comments for documentation
COMMENT ON COLUMN documents.ocr_confidence IS 'OCR confidence score (0-100)';
COMMENT ON COLUMN documents.ocr_word_count IS 'Number of words extracted by OCR';
COMMENT ON COLUMN documents.ocr_processing_time_ms IS 'Time taken for OCR processing in milliseconds';

COMMENT ON COLUMN settings.ocr_page_segmentation_mode IS 'Tesseract Page Segmentation Mode (0-13), default 3=PSM_AUTO';
COMMENT ON COLUMN settings.ocr_engine_mode IS 'Tesseract OCR Engine Mode (0-3), default 3=OEM_DEFAULT';
COMMENT ON COLUMN settings.ocr_min_confidence IS 'Minimum OCR confidence threshold (0-100)';
COMMENT ON COLUMN settings.ocr_dpi IS 'Target DPI for OCR processing, 0=auto';
COMMENT ON COLUMN settings.ocr_enhance_contrast IS 'Enable adaptive contrast enhancement';
COMMENT ON COLUMN settings.ocr_remove_noise IS 'Enable image noise removal';
COMMENT ON COLUMN settings.ocr_detect_orientation IS 'Enable automatic orientation detection';
COMMENT ON COLUMN settings.ocr_whitelist_chars IS 'Characters to allow in OCR (null=all)';
COMMENT ON COLUMN settings.ocr_blacklist_chars IS 'Characters to exclude from OCR (null=none)';

-- Create index on OCR confidence for quality filtering
CREATE INDEX IF NOT EXISTS idx_documents_ocr_confidence ON documents(ocr_confidence) WHERE ocr_confidence IS NOT NULL;

-- Create index on word count for analytics
CREATE INDEX IF NOT EXISTS idx_documents_ocr_word_count ON documents(ocr_word_count) WHERE ocr_word_count IS NOT NULL;

-- Update existing settings to have the new defaults
UPDATE settings SET 
    ocr_page_segmentation_mode = 3,
    ocr_engine_mode = 3,
    ocr_min_confidence = 30.0,
    ocr_dpi = 300,
    ocr_enhance_contrast = true,
    ocr_remove_noise = true,
    ocr_detect_orientation = true
WHERE ocr_page_segmentation_mode IS NULL;

-- Create a view for enhanced OCR analytics
CREATE OR REPLACE VIEW ocr_analytics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_documents,
    COUNT(ocr_text) as documents_with_ocr,
    COUNT(ocr_confidence) as documents_with_confidence,
    AVG(ocr_confidence) as avg_confidence,
    MIN(ocr_confidence) as min_confidence,
    MAX(ocr_confidence) as max_confidence,
    AVG(ocr_word_count) as avg_word_count,
    SUM(ocr_word_count) as total_words_extracted,
    AVG(ocr_processing_time_ms) as avg_processing_time_ms,
    COUNT(*) FILTER (WHERE ocr_confidence < 50) as low_confidence_count,
    COUNT(*) FILTER (WHERE ocr_confidence >= 80) as high_confidence_count,
    COUNT(*) FILTER (WHERE ocr_status = 'failed') as failed_ocr_count
FROM documents 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

COMMENT ON VIEW ocr_analytics IS 'Daily OCR analytics for monitoring quality and performance';
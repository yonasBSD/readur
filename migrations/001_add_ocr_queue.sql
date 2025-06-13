-- Add OCR queue table for robust processing
CREATE TABLE IF NOT EXISTS ocr_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    priority INT DEFAULT 5,
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    worker_id VARCHAR(100),
    processing_time_ms INT,
    file_size BIGINT,
    CONSTRAINT check_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

-- Indexes for efficient queue operations
CREATE INDEX IF NOT EXISTS idx_ocr_queue_status ON ocr_queue(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_document_id ON ocr_queue(document_id);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_worker ON ocr_queue(worker_id) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_ocr_queue_created_at ON ocr_queue(created_at) WHERE status = 'pending';

-- Add processing status to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_error TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_completed_at TIMESTAMPTZ;

-- Metrics table for monitoring
CREATE TABLE IF NOT EXISTS ocr_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE DEFAULT CURRENT_DATE,
    hour INT DEFAULT EXTRACT(HOUR FROM NOW()),
    total_processed INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    total_retried INT DEFAULT 0,
    avg_processing_time_ms INT,
    max_processing_time_ms INT,
    min_processing_time_ms INT,
    queue_depth INT,
    active_workers INT,
    UNIQUE(date, hour)
);

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_ocr_queue_stats()
RETURNS TABLE (
    pending_count BIGINT,
    processing_count BIGINT,
    failed_count BIGINT,
    completed_today BIGINT,
    avg_wait_time_minutes DOUBLE PRECISION,
    oldest_pending_minutes DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
        COUNT(*) FILTER (WHERE status = 'failed' AND attempts >= max_attempts) as failed_count,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_today,
        AVG(EXTRACT(EPOCH FROM (COALESCE(started_at, NOW()) - created_at))/60) FILTER (WHERE status IN ('processing', 'completed')) as avg_wait_time_minutes,
        MAX(EXTRACT(EPOCH FROM (NOW() - created_at))/60) FILTER (WHERE status = 'pending') as oldest_pending_minutes
    FROM ocr_queue;
END;
$$ LANGUAGE plpgsql;
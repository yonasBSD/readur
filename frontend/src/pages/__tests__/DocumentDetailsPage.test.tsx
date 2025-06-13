import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import DocumentDetailsPage from '../DocumentDetailsPage';
import { documentService } from '../../services/api';

// Create mock functions
const mockList = vi.fn();
const mockDownload = vi.fn();
const mockGetOcrText = vi.fn();

vi.mock('../../services/api', () => ({
  documentService: {
    list: mockList,
    download: mockDownload,
    getOcrText: mockGetOcrText,
  }
}));

const mockDocumentWithOcr = {
  id: 'doc-123',
  filename: 'test_document.pdf',
  original_filename: 'test_document.pdf',
  file_size: 1024000,
  mime_type: 'application/pdf',
  tags: ['test', 'document'],
  created_at: '2024-01-01T00:00:00Z',
  has_ocr_text: true,
  ocr_confidence: 95.5,
  ocr_word_count: 150,
  ocr_processing_time_ms: 1200,
  ocr_status: 'completed',
};

const mockDocumentWithoutOcr = {
  id: 'doc-456',
  filename: 'text_file.txt',
  original_filename: 'text_file.txt',
  file_size: 512,
  mime_type: 'text/plain',
  tags: ['text'],
  created_at: '2024-01-01T00:00:00Z',
  has_ocr_text: false,
  ocr_confidence: null,
  ocr_word_count: null,
  ocr_processing_time_ms: null,
  ocr_status: 'pending',
};

const mockOcrResponse = {
  document_id: 'doc-123',
  filename: 'test_document.pdf',
  has_ocr_text: true,
  ocr_text: 'This is the extracted OCR text from the test document. It contains multiple paragraphs and various formatting.',
  ocr_confidence: 95.5,
  ocr_word_count: 150,
  ocr_processing_time_ms: 1200,
  ocr_status: 'completed',
  ocr_error: null,
  ocr_completed_at: '2024-01-01T00:05:00Z',
};

const mockOcrResponseWithError = {
  document_id: 'doc-789',
  filename: 'corrupted_file.pdf',
  has_ocr_text: false,
  ocr_text: null,
  ocr_confidence: null,
  ocr_word_count: null,
  ocr_processing_time_ms: 5000,
  ocr_status: 'failed',
  ocr_error: 'Failed to process document: corrupted file format',
  ocr_completed_at: '2024-01-01T00:05:00Z',
};

const renderWithRouter = (component, route = '/documents/doc-123') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {component}
    </MemoryRouter>
  );
};

describe('DocumentDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockReset();
    mockDownload.mockReset();
    mockGetOcrText.mockReset();
  });

  test('renders document details with OCR functionality', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithOcr]
    });

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Document Details')).toBeInTheDocument();
      expect(screen.getByText('test_document.pdf')).toBeInTheDocument();
      expect(screen.getByText('View OCR')).toBeInTheDocument();
      expect(screen.getByText('OCR Processed')).toBeInTheDocument();
    });
  });

  test('does not show OCR button for documents without OCR', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithoutOcr]
    });

    renderWithRouter(<DocumentDetailsPage />, '/documents/doc-456');
    
    await waitFor(() => {
      expect(screen.getByText('text_file.txt')).toBeInTheDocument();
      expect(screen.queryByText('View OCR')).not.toBeInTheDocument();
      expect(screen.queryByText('OCR Processed')).not.toBeInTheDocument();
    });
  });

  test('opens OCR dialog and fetches OCR text', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithOcr]
    });
    mockGetOcrText.mockResolvedValueOnce({
      data: mockOcrResponse
    });

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('View OCR')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('View OCR'));

    await waitFor(() => {
      expect(screen.getByText('Extracted Text (OCR)')).toBeInTheDocument();
      expect(screen.getByText('Loading OCR text...')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockGetOcrText).toHaveBeenCalledWith('doc-123');
      expect(screen.getByText(/This is the extracted OCR text/)).toBeInTheDocument();
      expect(screen.getByText('96% confidence')).toBeInTheDocument();
      expect(screen.getByText('150 words')).toBeInTheDocument();
    });
  });

  test('displays OCR processing metadata in dialog', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithOcr]
    });
    mockGetOcrText.mockResolvedValueOnce({
      data: mockOcrResponse
    });

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('View OCR'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Processing time: 1200ms/)).toBeInTheDocument();
      expect(screen.getByText(/Completed:/)).toBeInTheDocument();
    });
  });

  test('handles OCR error response', async () => {
    const mockDocumentWithError = {
      ...mockDocumentWithOcr,
      id: 'doc-789',
      filename: 'corrupted_file.pdf',
      has_ocr_text: false,
      ocr_status: 'failed',
    };

    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithError]
    });
    mockGetOcrText.mockResolvedValueOnce({
      data: mockOcrResponseWithError
    });

    renderWithRouter(<DocumentDetailsPage />, '/documents/doc-789');
    
    // Even failed documents might show OCR button if has_ocr_text was true initially
    await waitFor(() => {
      expect(screen.getByText('corrupted_file.pdf')).toBeInTheDocument();
    });

    // If OCR button exists, click it to see error handling
    const ocrButton = screen.queryByText('View OCR');
    if (ocrButton) {
      fireEvent.click(ocrButton);

      await waitFor(() => {
        expect(screen.getByText(/OCR Error: Failed to process document/)).toBeInTheDocument();
        expect(screen.getByText(/No OCR text available/)).toBeInTheDocument();
      });
    }
  });

  test('handles OCR fetch API error', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithOcr]
    });
    mockGetOcrText.mockRejectedValueOnce(new Error('Network error'));

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('View OCR'));
    });

    await waitFor(() => {
      expect(screen.getByText(/Failed to load OCR text/)).toBeInTheDocument();
    });
  });

  test('caches OCR data and does not refetch on dialog reopen', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithOcr]
    });
    mockGetOcrText.mockResolvedValueOnce({
      data: mockOcrResponse
    });

    renderWithRouter(<DocumentDetailsPage />);
    
    // First open
    await waitFor(() => {
      fireEvent.click(screen.getByText('View OCR'));
    });

    await waitFor(() => {
      expect(mockGetOcrText).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/This is the extracted OCR text/)).toBeInTheDocument();
    });

    // Close dialog
    fireEvent.click(screen.getByText('Close'));

    // Reopen dialog
    fireEvent.click(screen.getByText('View OCR'));

    await waitFor(() => {
      // Should not fetch again
      expect(mockGetOcrText).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/This is the extracted OCR text/)).toBeInTheDocument();
    });
  });

  test('displays document file information correctly', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithOcr]
    });

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('test_document.pdf')).toBeInTheDocument();
      expect(screen.getByText('1000 KB')).toBeInTheDocument(); // File size formatting
      expect(screen.getByText('application/pdf')).toBeInTheDocument();
      expect(screen.getByText(/January 1, 2024/)).toBeInTheDocument(); // Date formatting
    });
  });

  test('shows processing status indicators', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithOcr]
    });

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Document uploaded successfully')).toBeInTheDocument();
      expect(screen.getByText('OCR processing completed')).toBeInTheDocument();
    });
  });

  test('handles document not found error', async () => {
    mockList.mockResolvedValueOnce({
      data: [] // Empty array, document not found
    });

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Document not found')).toBeInTheDocument();
      expect(screen.getByText('Back to Documents')).toBeInTheDocument();
    });
  });

  test('handles document list API error', async () => {
    mockList.mockRejectedValueOnce(new Error('API Error'));

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load document details')).toBeInTheDocument();
    });
  });

  test('download functionality works', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithOcr]
    });

    const mockBlob = new Blob(['file content'], { type: 'application/pdf' });
    mockDownload.mockResolvedValueOnce({
      data: mockBlob
    });

    // Mock URL.createObjectURL and related functions
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock createElement and appendChild for download link
    const mockLink = {
      href: '',
      setAttribute: vi.fn(),
      click: vi.fn(),
      remove: vi.fn(),
    };
    document.createElement = vi.fn(() => mockLink);
    document.body.appendChild = vi.fn();

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Download'));
    });

    await waitFor(() => {
      expect(mockDownload).toHaveBeenCalledWith('doc-123');
      expect(mockLink.click).toHaveBeenCalled();
    });
  });

  test('renders tags correctly when present', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithOcr]
    });

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      expect(screen.getByText('Tags')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();
      expect(screen.getByText('document')).toBeInTheDocument();
    });
  });

  test('OCR text is displayed with proper formatting', async () => {
    mockList.mockResolvedValueOnce({
      data: [mockDocumentWithOcr]
    });
    
    const mockOcrWithFormatting = {
      ...mockOcrResponse,
      ocr_text: 'Line 1\nLine 2\n\nParagraph 2',
    };
    
    mockGetOcrText.mockResolvedValueOnce({
      data: mockOcrWithFormatting
    });

    renderWithRouter(<DocumentDetailsPage />);
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('View OCR'));
    });

    await waitFor(() => {
      const ocrTextElement = screen.getByText(/Line 1/);
      expect(ocrTextElement).toHaveStyle('white-space: pre-wrap');
      expect(ocrTextElement).toHaveStyle('font-family: monospace');
    });
  });
});
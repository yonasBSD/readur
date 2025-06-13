import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DocumentDetailsPage from '../DocumentDetailsPage';

// Simple mock data
const mockDocument = {
  id: 'doc-123',
  filename: 'test_document.pdf',
  original_filename: 'test_document.pdf',
  file_size: 1024000,
  mime_type: 'application/pdf',
  tags: ['test', 'document'],
  created_at: '2024-01-01T00:00:00Z',
  has_ocr_text: true,
};

// Mock the document service
const mockDocumentService = {
  list: vi.fn(),
  download: vi.fn(),
  getOcrText: vi.fn(),
};

vi.mock('../../services/api', () => ({
  documentService: mockDocumentService,
}));

const renderWithRouter = (route = '/documents/doc-123') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <DocumentDetailsPage />
    </MemoryRouter>
  );
};

describe('DocumentDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDocumentService.list.mockReset();
    mockDocumentService.download.mockReset();
    mockDocumentService.getOcrText.mockReset();
  });

  test('renders loading state initially', () => {
    mockDocumentService.list.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    renderWithRouter();
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('renders document details when data loads', async () => {
    mockDocumentService.list.mockResolvedValueOnce({
      data: [mockDocument]
    });

    renderWithRouter();
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    }, { timeout: 5000 });
    
    await waitFor(() => {
      expect(screen.getByText('test_document.pdf')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  test('shows error when document not found', async () => {
    mockDocumentService.list.mockResolvedValueOnce({
      data: [] // Empty array
    });

    renderWithRouter();
    
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    }, { timeout: 5000 });
    
    await waitFor(() => {
      expect(screen.getByText('Document not found')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
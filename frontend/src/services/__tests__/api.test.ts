import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { documentService, type OcrResponse, type Document } from '../api';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

describe('documentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOcrText', () => {
    const mockOcrResponse: OcrResponse = {
      document_id: 'doc-123',
      filename: 'test_document.pdf',
      has_ocr_text: true,
      ocr_text: 'This is extracted OCR text content.',
      ocr_confidence: 95.5,
      ocr_word_count: 150,
      ocr_processing_time_ms: 1200,
      ocr_status: 'completed',
      ocr_error: null,
      ocr_completed_at: '2024-01-01T00:05:00Z',
    };

    it('should fetch OCR text for a document', async () => {
      const mockResponse = {
        data: mockOcrResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await documentService.getOcrText('doc-123');

      expect(result.data).toEqual(mockOcrResponse);
      expect(result.data.document_id).toBe('doc-123');
      expect(result.data.has_ocr_text).toBe(true);
      expect(result.data.ocr_text).toBe('This is extracted OCR text content.');
      expect(result.data.ocr_confidence).toBe(95.5);
      expect(result.data.ocr_word_count).toBe(150);
    });

    it('should handle OCR response without text', async () => {
      const mockEmptyOcrResponse: OcrResponse = {
        document_id: 'doc-456',
        filename: 'text_file.txt',
        has_ocr_text: false,
        ocr_text: null,
        ocr_confidence: null,
        ocr_word_count: null,
        ocr_processing_time_ms: null,
        ocr_status: 'pending',
        ocr_error: null,
        ocr_completed_at: null,
      };

      const mockResponse = {
        data: mockEmptyOcrResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await documentService.getOcrText('doc-456');

      expect(result.data).toEqual(mockEmptyOcrResponse);
      expect(result.data.has_ocr_text).toBe(false);
      expect(result.data.ocr_text).toBeNull();
      expect(result.data.ocr_confidence).toBeNull();
    });

    it('should handle OCR error response', async () => {
      const mockErrorOcrResponse: OcrResponse = {
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

      const mockResponse = {
        data: mockErrorOcrResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await documentService.getOcrText('doc-789');

      expect(result.data).toEqual(mockErrorOcrResponse);
      expect(result.data.ocr_status).toBe('failed');
      expect(result.data.ocr_error).toBe('Failed to process document: corrupted file format');
      expect(result.data.has_ocr_text).toBe(false);
    });

    it('should make correct API call', async () => {
      const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue({ data: mockOcrResponse }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      await documentService.getOcrText('doc-123');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/documents/doc-123/ocr');
    });

    it('should handle network errors', async () => {
      const mockAxiosInstance = {
        get: vi.fn().mockRejectedValue(new Error('Network Error')),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      await expect(documentService.getOcrText('doc-123')).rejects.toThrow('Network Error');
    });

    it('should handle 404 errors for non-existent documents', async () => {
      const mockAxiosInstance = {
        get: vi.fn().mockRejectedValue({
          response: {
            status: 404,
            data: { error: 'Document not found' },
          },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      await expect(documentService.getOcrText('non-existent-doc')).rejects.toMatchObject({
        response: {
          status: 404,
        },
      });
    });

    it('should handle 401 unauthorized errors', async () => {
      const mockAxiosInstance = {
        get: vi.fn().mockRejectedValue({
          response: {
            status: 401,
            data: { error: 'Unauthorized' },
          },
        }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      await expect(documentService.getOcrText('doc-123')).rejects.toMatchObject({
        response: {
          status: 401,
        },
      });
    });
  });

  describe('list', () => {
    const mockDocuments: Document[] = [
      {
        id: 'doc-1',
        filename: 'document1.pdf',
        original_filename: 'document1.pdf',
        file_size: 1024000,
        mime_type: 'application/pdf',
        tags: ['pdf', 'document'],
        created_at: '2024-01-01T00:00:00Z',
        has_ocr_text: true,
        ocr_confidence: 95.5,
        ocr_word_count: 150,
        ocr_processing_time_ms: 1200,
        ocr_status: 'completed',
      },
      {
        id: 'doc-2',
        filename: 'image.png',
        original_filename: 'image.png',
        file_size: 512000,
        mime_type: 'image/png',
        tags: ['image'],
        created_at: '2024-01-02T00:00:00Z',
        has_ocr_text: false,
        ocr_confidence: undefined,
        ocr_word_count: undefined,
        ocr_processing_time_ms: undefined,
        ocr_status: 'pending',
      },
    ];

    it('should fetch document list with OCR metadata', async () => {
      const mockResponse = {
        data: mockDocuments,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      };

      mockedAxios.create.mockReturnValue({
        get: vi.fn().mockResolvedValue(mockResponse),
      } as any);

      const result = await documentService.list(50, 0);

      expect(result.data).toEqual(mockDocuments);
      expect(result.data[0].has_ocr_text).toBe(true);
      expect(result.data[0].ocr_confidence).toBe(95.5);
      expect(result.data[1].has_ocr_text).toBe(false);
      expect(result.data[1].ocr_confidence).toBeUndefined();
    });
  });

  describe('upload', () => {
    it('should upload file with multipart form data', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const mockUploadResponse: Document = {
        id: 'doc-new',
        filename: 'test.pdf',
        original_filename: 'test.pdf',
        file_size: 7,
        mime_type: 'application/pdf',
        tags: [],
        created_at: '2024-01-01T00:00:00Z',
        has_ocr_text: false,
        ocr_status: 'pending',
      };

      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue({ data: mockUploadResponse }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const result = await documentService.upload(mockFile);

      expect(result.data).toEqual(mockUploadResponse);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/documents',
        expect.any(FormData),
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
    });
  });

  describe('download', () => {
    it('should download file as blob', async () => {
      const mockBlob = new Blob(['file content'], { type: 'application/pdf' });
      const mockAxiosInstance = {
        get: vi.fn().mockResolvedValue({ data: mockBlob }),
      };

      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);

      const result = await documentService.download('doc-123');

      expect(result.data).toEqual(mockBlob);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/documents/doc-123/download', {
        responseType: 'blob',
      });
    });
  });
});

describe('OcrResponse interface', () => {
  it('should have correct type structure', () => {
    const ocrResponse: OcrResponse = {
      document_id: 'doc-123',
      filename: 'test.pdf',
      has_ocr_text: true,
      ocr_text: 'Sample text',
      ocr_confidence: 95.5,
      ocr_word_count: 100,
      ocr_processing_time_ms: 1000,
      ocr_status: 'completed',
      ocr_error: null,
      ocr_completed_at: '2024-01-01T00:00:00Z',
    };

    // Type assertions to ensure correct types
    expect(typeof ocrResponse.document_id).toBe('string');
    expect(typeof ocrResponse.filename).toBe('string');
    expect(typeof ocrResponse.has_ocr_text).toBe('boolean');
    expect(typeof ocrResponse.ocr_text).toBe('string');
    expect(typeof ocrResponse.ocr_confidence).toBe('number');
    expect(typeof ocrResponse.ocr_word_count).toBe('number');
    expect(typeof ocrResponse.ocr_processing_time_ms).toBe('number');
    expect(typeof ocrResponse.ocr_status).toBe('string');
    expect(ocrResponse.ocr_error).toBeNull();
    expect(typeof ocrResponse.ocr_completed_at).toBe('string');
  });

  it('should allow optional/null fields', () => {
    const ocrResponseMinimal: OcrResponse = {
      document_id: 'doc-456',
      filename: 'text.txt',
      has_ocr_text: false,
      ocr_text: null,
      ocr_confidence: undefined,
      ocr_word_count: undefined,
      ocr_processing_time_ms: undefined,
      ocr_status: 'pending',
      ocr_error: undefined,
      ocr_completed_at: undefined,
    };

    expect(ocrResponseMinimal.has_ocr_text).toBe(false);
    expect(ocrResponseMinimal.ocr_text).toBeNull();
    expect(ocrResponseMinimal.ocr_confidence).toBeUndefined();
  });
});
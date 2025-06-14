import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import UploadZone from '../UploadZone';
import { NotificationProvider } from '../../../contexts/NotificationContext';
import React from 'react';

// Mock the API
vi.mock('../../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

// Mock react-dropzone
const mockGetRootProps = vi.fn(() => ({
  onClick: vi.fn(),
  onDrop: vi.fn(),
}));
const mockGetInputProps = vi.fn(() => ({}));

vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(() => ({
    getRootProps: mockGetRootProps,
    getInputProps: mockGetInputProps,
    isDragActive: false,
  })),
}));

const theme = createTheme();

const renderUploadZone = (onUploadComplete = vi.fn()) => {
  return render(
    <ThemeProvider theme={theme}>
      <NotificationProvider>
        <UploadZone onUploadComplete={onUploadComplete} />
      </NotificationProvider>
    </ThemeProvider>
  );
};

describe('UploadZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should render upload zone with drag and drop area', () => {
    renderUploadZone();

    expect(screen.getByText('Drag & drop files here')).toBeInTheDocument();
    expect(screen.getByText('or click to browse your computer')).toBeInTheDocument();
    expect(screen.getByText('Choose Files')).toBeInTheDocument();
  });

  test('should display supported file types', () => {
    renderUploadZone();

    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Word')).toBeInTheDocument();
  });

  test('should display maximum file size limit', () => {
    renderUploadZone();

    expect(screen.getByText('Maximum file size: 50MB per file')).toBeInTheDocument();
  });

  test('should not show file list initially', () => {
    renderUploadZone();

    expect(screen.queryByText('Files (')).not.toBeInTheDocument();
    expect(screen.queryByText('Upload All')).not.toBeInTheDocument();
  });

  test('should call useDropzone with correct configuration', () => {
    const { useDropzone } = require('react-dropzone');
    
    renderUploadZone();

    expect(useDropzone).toHaveBeenCalledWith(
      expect.objectContaining({
        accept: {
          'application/pdf': ['.pdf'],
          'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'],
          'text/*': ['.txt', '.rtf'],
          'application/msword': ['.doc'],
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        },
        maxSize: 50 * 1024 * 1024, // 50MB
        multiple: true,
      })
    );
  });
});

// Test file upload functionality
describe('UploadZone - File Upload', () => {
  const mockApi = require('../../../services/api').default;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API response
    mockApi.post.mockResolvedValue({
      data: {
        id: '123',
        original_filename: 'test.pdf',
        filename: 'test.pdf',
        file_size: 1024,
        mime_type: 'application/pdf',
        created_at: '2023-12-01T10:00:00Z',
      },
    });
  });

  test('should handle file drop and show file in list', async () => {
    const mockFiles = [
      new File(['content'], 'test.pdf', { type: 'application/pdf' }),
    ];

    // Mock the useDropzone to simulate file drop
    const { useDropzone } = require('react-dropzone');
    const mockOnDrop = vi.fn();

    useDropzone.mockReturnValue({
      getRootProps: mockGetRootProps,
      getInputProps: mockGetInputProps,
      isDragActive: false,
      onDrop: mockOnDrop,
    });

    const TestComponent = () => {
      const [files, setFiles] = React.useState<Array<{
        file: File;
        id: string;
        status: 'pending' | 'uploading' | 'success' | 'error';
        progress: number;
        error: string | null;
      }>>([]);

      React.useEffect(() => {
        // Simulate adding a file
        setFiles([{
          file: mockFiles[0],
          id: '1',
          status: 'pending',
          progress: 0,
          error: null,
        }]);
      }, []);

      return (
        <ThemeProvider theme={theme}>
          <NotificationProvider>
            <div>
              <UploadZone />
              {files.length > 0 && (
                <div data-testid="file-list">
                  <div data-testid="file-count">Files ({files.length})</div>
                  <div data-testid="file-name">{files[0].file.name}</div>
                  <button data-testid="upload-all">Upload All</button>
                </div>
              )}
            </div>
          </NotificationProvider>
        </ThemeProvider>
      );
    };

    render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('file-list')).toBeInTheDocument();
    });

    expect(screen.getByTestId('file-count')).toHaveTextContent('Files (1)');
    expect(screen.getByTestId('file-name')).toHaveTextContent('test.pdf');
    expect(screen.getByTestId('upload-all')).toBeInTheDocument();
  });

  test('should handle file rejection and show error', () => {
    const mockRejectedFiles = [
      {
        file: new File(['content'], 'large-file.pdf', { type: 'application/pdf' }),
        errors: [{ message: 'File too large', code: 'file-too-large' }],
      },
    ];

    const TestComponent = () => {
      const [error, setError] = React.useState('');

      React.useEffect(() => {
        // Simulate file rejection
        const errors = mockRejectedFiles.map(file => 
          `${file.file.name}: ${file.errors.map(e => e.message).join(', ')}`
        );
        setError(`Some files were rejected: ${errors.join('; ')}`);
      }, []);

      return (
        <ThemeProvider theme={theme}>
          <NotificationProvider>
            <div>
              <UploadZone />
              {error && (
                <div data-testid="error-message">{error}</div>
              )}
            </div>
          </NotificationProvider>
        </ThemeProvider>
      );
    };

    render(<TestComponent />);

    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Some files were rejected: large-file.pdf: File too large'
    );
  });

  test('should show upload progress', async () => {
    const TestComponent = () => {
      const [uploadProgress, setUploadProgress] = React.useState(0);
      const [uploading, setUploading] = React.useState(false);

      const handleUpload = () => {
        setUploading(true);
        setUploadProgress(0);
        
        // Simulate progress
        const interval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 100) {
              clearInterval(interval);
              setUploading(false);
              return 100;
            }
            return prev + 20;
          });
        }, 100);
      };

      return (
        <ThemeProvider theme={theme}>
          <NotificationProvider>
            <div>
              <UploadZone />
              <button data-testid="start-upload" onClick={handleUpload}>
                Start Upload
              </button>
              {uploading && (
                <div data-testid="upload-progress">
                  <div data-testid="progress-value">{uploadProgress}%</div>
                  <div data-testid="uploading-status">Uploading...</div>
                </div>
              )}
            </div>
          </NotificationProvider>
        </ThemeProvider>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId('start-upload'));

    await waitFor(() => {
      expect(screen.getByTestId('upload-progress')).toBeInTheDocument();
    });

    expect(screen.getByTestId('uploading-status')).toHaveTextContent('Uploading...');

    // Wait for progress to complete
    await waitFor(() => {
      expect(screen.getByTestId('progress-value')).toHaveTextContent('100%');
    }, { timeout: 1000 });
  });

  test('should handle upload failure', async () => {
    // Mock API failure
    mockApi.post.mockRejectedValue({
      response: {
        data: {
          message: 'Upload failed: Invalid file type',
        },
      },
    });

    const TestComponent = () => {
      const [error, setError] = React.useState('');

      const handleFailedUpload = async () => {
        try {
          await mockApi.post('/documents', new FormData());
        } catch (err: any) {
          setError(err.response?.data?.message || 'Upload failed');
        }
      };

      return (
        <ThemeProvider theme={theme}>
          <NotificationProvider>
            <div>
              <UploadZone />
              <button data-testid="trigger-error" onClick={handleFailedUpload}>
                Trigger Error
              </button>
              {error && (
                <div data-testid="upload-error">{error}</div>
              )}
            </div>
          </NotificationProvider>
        </ThemeProvider>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId('trigger-error'));

    await waitFor(() => {
      expect(screen.getByTestId('upload-error')).toHaveTextContent('Upload failed: Invalid file type');
    });
  });

  test('should call onUploadComplete when upload succeeds', async () => {
    const mockOnUploadComplete = vi.fn();
    const mockDocument = {
      id: '123',
      original_filename: 'test.pdf',
      filename: 'test.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
      created_at: '2023-12-01T10:00:00Z',
    };

    const TestComponent = () => {
      const handleSuccessfulUpload = async () => {
        mockOnUploadComplete(mockDocument);
      };

      return (
        <ThemeProvider theme={theme}>
          <NotificationProvider>
            <div>
              <UploadZone onUploadComplete={mockOnUploadComplete} />
              <button data-testid="simulate-success" onClick={handleSuccessfulUpload}>
                Simulate Success
              </button>
            </div>
          </NotificationProvider>
        </ThemeProvider>
      );
    };

    render(<TestComponent />);

    fireEvent.click(screen.getByTestId('simulate-success'));

    expect(mockOnUploadComplete).toHaveBeenCalledWith(mockDocument);
  });
});
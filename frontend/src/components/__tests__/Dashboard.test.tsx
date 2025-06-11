import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import Dashboard from '../Dashboard'
import { documentService } from '../../services/api'

// Mock the API service
vi.mock('../../services/api', () => ({
  documentService: {
    list: vi.fn(),
    search: vi.fn(),
  },
}))

// Mock child components
vi.mock('../FileUpload', () => ({
  default: ({ onUploadSuccess }: any) => (
    <div data-testid="file-upload">File Upload Component</div>
  ),
}))

vi.mock('../DocumentList', () => ({
  default: ({ documents, loading }: any) => (
    <div data-testid="document-list">
      {loading ? 'Loading...' : `${documents.length} documents`}
    </div>
  ),
}))

vi.mock('../SearchBar', () => ({
  default: ({ onSearch }: any) => (
    <input
      data-testid="search-bar"
      placeholder="Search"
      onChange={(e) => onSearch(e.target.value)}
    />
  ),
}))

const mockDocuments = [
  {
    id: '1',
    filename: 'test1.pdf',
    original_filename: 'test1.pdf',
    file_size: 1024,
    mime_type: 'application/pdf',
    tags: [],
    created_at: '2023-01-01T00:00:00Z',
    has_ocr_text: true,
  },
  {
    id: '2',
    filename: 'test2.txt',
    original_filename: 'test2.txt',
    file_size: 512,
    mime_type: 'text/plain',
    tags: ['important'],
    created_at: '2023-01-02T00:00:00Z',
    has_ocr_text: false,
  },
]

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders dashboard with file upload and document list', async () => {
    const mockList = vi.mocked(documentService.list)
    mockList.mockResolvedValue({ data: mockDocuments })

    render(<Dashboard />)

    expect(screen.getByText('Document Management')).toBeInTheDocument()
    expect(screen.getByTestId('file-upload')).toBeInTheDocument()
    expect(screen.getByTestId('search-bar')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(screen.getByTestId('document-list')).toBeInTheDocument()
      expect(screen.getByText('2 documents')).toBeInTheDocument()
    })
  })

  test('handles loading state', () => {
    const mockList = vi.mocked(documentService.list)
    mockList.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<Dashboard />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  test('handles search functionality', async () => {
    const mockList = vi.mocked(documentService.list)
    const mockSearch = vi.mocked(documentService.search)
    
    mockList.mockResolvedValue({ data: mockDocuments })
    mockSearch.mockResolvedValue({
      data: {
        documents: [mockDocuments[0]],
        total: 1,
      },
    })

    render(<Dashboard />)

    await waitFor(() => {
      expect(screen.getByText('2 documents')).toBeInTheDocument()
    })

    const searchBar = screen.getByTestId('search-bar')
    searchBar.dispatchEvent(new Event('change', { bubbles: true }))

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalled()
    })
  })
})
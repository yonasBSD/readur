import React from 'react'
import {
  DocumentIcon,
  PhotoIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { Document, documentService } from '../services/api'

interface DocumentListProps {
  documents: Document[]
  loading: boolean
}

function DocumentList({ documents, loading }: DocumentListProps) {
  const handleDownload = async (document: Document) => {
    try {
      const response = await documentService.download(document.id)
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.original_filename
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <PhotoIcon className="h-8 w-8 text-green-500" />
    }
    return <DocumentIcon className="h-8 w-8 text-blue-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading documents...</p>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-gray-600">No documents found</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {documents.map((document) => (
          <li key={document.id}>
            <div className="px-4 py-4 flex items-center justify-between">
              <div className="flex items-center">
                {getFileIcon(document.mime_type)}
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-900">
                    {document.original_filename}
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatFileSize(document.file_size)} • {document.mime_type}
                    {document.has_ocr_text && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        OCR
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(document.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDownload(document)}
                className="ml-4 inline-flex items-center p-2 border border-transparent rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default DocumentList
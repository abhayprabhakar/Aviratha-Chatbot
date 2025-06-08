'use client'

import { useState, useEffect } from 'react'
import { Upload, Trash2, FileText, Clock, User } from 'lucide-react'

interface Document {
  id: string
  title: string
  fileName: string
  fileType: string
  fileSize: number
  uploadedBy: string
  createdAt: string
  isPublic: boolean
}

export default function AdminPanel() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/admin/documents')
      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
      setMessage('Failed to fetch documents')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('File uploaded successfully!')
        fetchDocuments() // Refresh the list
      } else {
        setMessage(data.error || 'Failed to upload file')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      setMessage('Failed to upload file')
    } finally {
      setUploading(false)
      event.target.value = '' // Reset file input
    }
  }

  const handleDeleteDocument = async (documentId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/documents?id=${documentId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage('Document deleted successfully')
        fetchDocuments() // Refresh the list
      } else {
        setMessage('Failed to delete document')
      }
    } catch (error) {
      console.error('Error deleting document:', error)
      setMessage('Failed to delete document')
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-gray-600 mt-1">Manage the knowledge base documents</p>
          </div>

          {/* Upload Section */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload New Document</h2>
            <div className="flex items-center space-x-4">
              <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center space-x-2 transition-colors">
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Uploading...' : 'Choose File'}</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".pdf,.txt,.docx,.doc,.md"
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <span className="text-sm text-gray-500">
                Supported formats: PDF, TXT, DOCX, DOC, MD
              </span>
            </div>
            {message && (
              <div className={`mt-4 p-3 rounded-md ${
                message.includes('success') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {message}
              </div>
            )}
          </div>

          {/* Documents List */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Knowledge Base Documents</h2>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-2">Loading documents...</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {documents.map((doc) => (
                  <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{doc.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">{doc.fileName}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                          <div className="flex items-center space-x-1">
                            <FileText className="w-3 h-3" />
                            <span>{doc.fileType.toUpperCase()}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span>{formatFileSize(doc.fileSize)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <User className="w-3 h-3" />
                            <span>{doc.uploadedBy}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(doc.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteDocument(doc.id, doc.fileName)}
                        className="ml-4 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

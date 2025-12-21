import React, { useState, useEffect } from 'react'
import { FileText, Calendar, Trash2, Download } from 'lucide-react'

interface Document {
  id: string
  name: string
  uploadedAt: Date
  size: number
  chunks: number
}

export default function Documents() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Fetch documents from backend
    const fetchDocuments = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        const response = await fetch('/api/documents', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        if (!response.ok) throw new Error('Failed to fetch documents')
        const data = await response.json()
        setDocuments(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDocuments()
  }, [])

  const handleDelete = async (id: string) => {
    if (globalThis.confirm?.('Are you sure you want to delete this document?')) {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`/api/documents/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        if (!response.ok) throw new Error('Failed to delete document')
        setDocuments((prev) => prev.filter((doc) => doc.id !== id))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete')
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Documents</h1>
        <p className="text-slate-400">Manage and organize your uploaded documents</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">Loading documents...</div>
        </div>
      )}

      {!loading && documents.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64">
          <FileText className="w-16 h-16 text-slate-600 mb-4" />
          <p className="text-slate-400 mb-2">No documents uploaded yet</p>
          <p className="text-slate-500 text-sm">Go to the Upload page to add documents</p>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <div className="grid gap-4">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <FileText className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-white truncate">{doc.name}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-400 mt-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </span>
                      <span>{(doc.size / 1024 / 1024).toFixed(2)} MB</span>
                      <span>{doc.chunks} chunks</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = `/api/documents/${doc.id}/download`
                      link.download = doc.name
                      link.click()
                    }}
                    className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

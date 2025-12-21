import React, { useState } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { useDocumentStore } from '../stores/documentStore'

export default function FileUpload() {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { addDocument } = useDocumentStore()

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    await handleFiles(files)
  }

  const handleFiles = async (files: File[]) => {
    setIsLoading(true)
    try {
      for (const file of files) {
        addDocument({
          id: Math.random().toString(36).slice(2),
          name: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          status: 'processing',
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
      className={`border-2 border-dashed rounded-xl p-8 transition-colors ${
        isDragging
          ? 'border-blue-500 bg-blue-500/5'
          : 'border-slate-600 hover:border-slate-500'
      }`}
    >
      <div className="flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
          <Upload className="w-6 h-6 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          {isLoading ? 'Uploading...' : 'Drop files here'}
        </h3>
        <p className="text-slate-400 mb-4">
          or click to select files from your computer
        </p>
        <button
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
              Uploading
            </>
          ) : (
            'Select Files'
          )}
        </button>
      </div>
    </div>
  )
}

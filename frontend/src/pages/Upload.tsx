import React, { useState, useRef } from 'react'
import { Upload as UploadIcon, File, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface UploadResult {
  success: boolean
  filename: string
  message: string
}

export default function Upload() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<HTMLDivElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragRef.current) {
      dragRef.current.classList.add('bg-blue-500/20', 'border-blue-500')
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragRef.current) {
      dragRef.current.classList.remove('bg-blue-500/20', 'border-blue-500')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragRef.current) {
      dragRef.current.classList.remove('bg-blue-500/20', 'border-blue-500')
    }
    handleFiles(e.dataTransfer.files)
  }

  const handleFiles = (fileList: FileList) => {
    setError(null)
    const newFiles = Array.from(fileList)
    
    // Validate files
    const validFiles = newFiles.filter((file) => {
      if (!file.name.match(/\.(pdf|txt|doc|docx)$/i)) {
        setError(`Invalid file type: ${file.name}. Supported formats: PDF, TXT, DOC, DOCX`)
        return false
      }
      if (file.size > 50 * 1024 * 1024) {
        setError(`File too large: ${file.name}. Maximum size: 50MB`)
        return false
      }
      return true
    })

    setFiles((prev) => [...prev, ...validFiles])
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setError(null)
    setUploadResults([])

    try {
      const token = localStorage.getItem('token')
      const results: UploadResult[] = []

      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)

        try {
          const response = await fetch('http://localhost:3000/api/documents/upload', {
            method: 'POST',
            headers: {
              ...(token && { 'Authorization': `Bearer ${token}` }),
            },
            body: formData,
          })

          if (response.ok) {
            const data = await response.json()
            results.push({
              success: true,
              filename: file.name,
              message: `Successfully uploaded (${data.data?.chunks || 0} chunks)`,
            })
          } else {
            results.push({
              success: false,
              filename: file.name,
              message: `Upload failed: ${response.statusText}`,
            })
          }
        } catch (err) {
          results.push({
            success: false,
            filename: file.name,
            message: err instanceof Error ? err.message : 'Upload failed',
          })
        }
      }

      setUploadResults(results)
      if (results.every((r) => r.success)) {
        setFiles([])
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Upload Documents</h1>
        <p className="text-slate-400">Upload documents to analyze and ask questions about them</p>
      </div>

      {/* Drag and Drop Area */}
      <div
        ref={dragRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="mb-8 border-2 border-dashed border-slate-600 rounded-lg p-12 text-center transition-colors cursor-pointer hover:border-blue-500/50"
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadIcon className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Drag and drop files here</h2>
        <p className="text-slate-400 mb-4">or click to select files</p>
        <p className="text-sm text-slate-500">Supported formats: PDF, TXT, DOC, DOCX (max 50MB each)</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          accept=".pdf,.txt,.doc,.docx"
          className="hidden"
        />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Files to Upload</h3>
          <div className="space-y-4">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${file.lastModified}`}
                className="rounded-2xl border border-slate-700/70 bg-slate-900/85 p-5 shadow-lg shadow-blue-950/5 transition-transform hover:-translate-y-0.5"
              >
                <div className="flex flex-col gap-5">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-purple-500/20 text-blue-100">
                      <File className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-white sm:text-base">{file.name}</p>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-700/60 bg-slate-800/70 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition-colors hover:border-red-400/50 hover:text-red-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-600"
                          disabled={uploading}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="inline-flex items-center rounded-full bg-slate-800/80 px-2.5 py-1 font-medium">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                        {file.type && (
                          <span className="inline-flex items-center rounded-full bg-slate-800/80 px-2.5 py-1 font-medium uppercase tracking-wide text-slate-300">
                            {file.type.split('/').pop()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {uploading ? (
                    <div className="space-y-2">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80">
                        <div className="h-full w-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse" />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Uploading…
                        </span>
                        <span className="text-slate-400">Preparing chunks</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                      <span>Status</span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1 font-medium text-blue-200">
                        <svg
                          className="h-1.5 w-1.5 text-blue-400"
                          viewBox="0 0 6 6"
                          aria-hidden="true"
                        >
                          <circle cx="3" cy="3" r="3" fill="currentColor" />
                        </svg>
                        Ready to upload
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="mt-6 w-full px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-400 hover:to-purple-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/25"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <UploadIcon className="w-5 h-5" />
                Upload {files.length} File{files.length === 1 ? '' : 's'}
              </>
            )}
          </button>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white mb-4">Upload Results</h3>
          {uploadResults.map((result) => (
            <div
              key={`${result.filename}-${result.success}-${result.message}`}
              className={`flex items-start gap-3 p-4 rounded-lg border ${
                result.success
                  ? 'bg-green-500/20 border-green-500/50'
                  : 'bg-red-500/20 border-red-500/50'
              }`}
            >
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <p className={result.success ? 'text-green-200' : 'text-red-200'}>
                  {result.filename}
                </p>
                <p className={`text-sm ${result.success ? 'text-green-300/70' : 'text-red-300/70'}`}>
                  {result.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

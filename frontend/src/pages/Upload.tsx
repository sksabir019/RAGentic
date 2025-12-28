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
          const response = await fetch('/api/documents/upload', {
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

  const totalSize = files.reduce((acc, file) => acc + file.size, 0)
  const successfulUploads = uploadResults.filter((result) => result.success).length

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-blue-400">Document Hub</p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <h1 className="text-3xl font-semibold text-white">Upload Documents</h1>
              <span className="rounded-full border border-blue-500/40 px-3 py-1 text-xs text-blue-200">
                Live pipeline view
              </span>
            </div>
            <p className="mt-2 text-slate-400">Drag your files, monitor parsing, and review ingestion status in real time.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                label: 'Queued Files',
                value: files.length,
                detail: totalSize ? `${(totalSize / 1024 / 1024).toFixed(1)} MB total` : 'No files selected',
              },
              {
                label: 'Successful Uploads',
                value: successfulUploads,
                detail: uploadResults.length ? `${uploadResults.length} processed` : 'Awaiting jobs',
              },
              {
                label: uploading ? 'Upload Status' : 'Pipeline',
                value: uploading ? 'In progress' : 'Ready',
                detail: uploading ? 'Chunking + embedding' : 'Drop files to begin',
              },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900/80 to-slate-900/40 p-4 shadow-lg shadow-black/20"
              >
                <p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-white">{card.value}</p>
                <p className="text-sm text-slate-500">{card.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-8">
            <div
              ref={dragRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900/90 to-slate-900/40 p-10 transition-colors hover:border-blue-500/40"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
              <div className="relative flex flex-col items-center text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300">
                  <UploadIcon className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-semibold text-white">Drag and drop files here</h2>
                <p className="mt-2 text-slate-400">or click to select files from your device</p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-400">
                  <span className="rounded-full border border-slate-700/70 px-3 py-1">PDF, TXT, DOC, DOCX</span>
                  <span className="rounded-full border border-slate-700/70 px-3 py-1">Up to 50 MB each</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  accept=".pdf,.txt,.doc,.docx"
                  className="hidden"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Files to Upload</h3>
                  <span className="text-xs uppercase tracking-wide text-slate-500">Queue • {files.length} file(s)</span>
                </div>
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
                          className="inline-flex items-center gap-1 rounded-md border border-slate-700/60 bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium text-slate-300 transition-colors hover:border-red-400/50 hover:text-red-200 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-600"
                          disabled={uploading}
                        >
                          <XCircle className="h-3 w-3" />
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

                <div className="flex justify-end">
                  <button
                    onClick={handleUpload}
                    disabled={uploading || files.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-medium text-white transition-all hover:from-blue-400 hover:to-purple-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
                  >
                    {uploading ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <UploadIcon className="h-4 w-4" />
                        Upload {files.length} File{files.length === 1 ? '' : 's'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {uploadResults.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-white">Upload Results</h3>
                {uploadResults.map((result) => (
                  <div
                    key={`${result.filename}-${result.success}-${result.message}`}
                    className={`flex items-start gap-3 rounded-2xl border p-4 ${
                      result.success
                        ? 'border-green-500/40 bg-green-500/10'
                        : 'border-red-500/40 bg-red-500/10'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{result.filename}</p>
                      <p className="text-xs text-slate-200/80">{result.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Ingestion Pipeline</p>
                <span className={`text-xs ${uploading ? 'text-blue-300' : 'text-slate-500'}`}>
                  {uploading ? 'Active' : 'Idle'}
                </span>
              </div>
              <div className="mt-4 space-y-4">
                {[
                  { label: 'Upload', description: 'Receiving file & metadata' },
                  { label: 'Chunking', description: 'Splitting into passages' },
                  { label: 'Embedding', description: 'Vectorizing content' },
                  { label: 'Indexing', description: 'Saving to RAG store' },
                ].map((stage, idx) => (
                  <div key={stage.label} className="flex items-start gap-3">
                    <div
                      className={`mt-1 h-2 w-2 rounded-full ${
                        uploading ? 'bg-blue-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{stage.label}</p>
                      <p className="text-xs text-slate-400">{stage.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <p className="text-sm font-semibold text-white">Upload Tips</p>
              <ul className="mt-4 space-y-3 text-sm text-slate-400">
                <li>• Combine related documents into a single PDF to keep context intact.</li>
                <li>• Use descriptive filenames—these become searchable labels.</li>
                <li>• Processing usually completes within seconds for files under 5 MB.</li>
                <li>• Re-run uploads anytime to refresh embeddings with new models.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{ text: string; source: string }>
  confidence?: number
  timestamp: Date
}

export default function Dashboard() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const navigate = useNavigate()

  const adjustTextareaHeight = (textarea?: HTMLTextAreaElement | null) => {
    if (!textarea) return
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, 160)
    textarea.style.height = `${Math.max(newHeight, 48)}px`
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value.slice(0, 1000)
    setInput(value)
    adjustTextareaHeight(event.target)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    adjustTextareaHeight(textareaRef.current)
  }, [input])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    adjustTextareaHeight(textareaRef.current)
    setIsLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3000/api/queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          query: input,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Query failed')
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'No response',
        citations: data.citations?.map((c: any) => ({
          text: c.text,
          source: c.documentName || c.documentId || 'Unknown',
        })),
        confidence: data.confidence,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred'
      )
      console.error('Query error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-700">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center mb-6 animate-pulse">
              <span className="text-4xl">✨</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Welcome to RAGentic
            </h2>
            <p className="text-slate-400 max-w-lg text-lg mb-8">
              Ask questions about your documents. Our AI-powered system will search, analyze, and provide accurate answers with citations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl w-full">
              <button
                type="button"
                onClick={() => navigate('/upload')}
                className="p-4 rounded-xl bg-gradient-to-br from-blue-600/80 to-purple-600/80 hover:from-blue-600 hover:to-purple-600 border border-blue-500/40 hover:border-blue-400/60 transition-all text-sm font-medium text-white hover:text-white shadow-lg hover:shadow-blue-500/20"
              >
                📄 Upload Documents
              </button>
              <button
                type="button"
                onClick={() => setInput('What is the main topic of these documents?')}
                className="p-4 rounded-xl bg-gradient-to-br from-cyan-600/80 to-blue-600/80 hover:from-cyan-600 hover:to-blue-600 border border-cyan-500/40 hover:border-cyan-400/60 transition-all text-sm font-medium text-white hover:text-white shadow-lg hover:shadow-cyan-500/20"
              >
                ❓ Ask Questions
              </button>
              <button
                type="button"
                onClick={() => navigate('/analytics')}
                className="p-4 rounded-xl bg-gradient-to-br from-purple-600/80 to-pink-600/80 hover:from-purple-600 hover:to-pink-600 border border-purple-500/40 hover:border-purple-400/60 transition-all text-sm font-medium text-white hover:text-white shadow-lg hover:shadow-purple-500/20"
              >
                📊 View Analytics
              </button>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              } animate-fadeIn`}
            >
              <div
                className={`max-w-2xl rounded-2xl p-4 sm:p-5 transition-all ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-none shadow-lg'
                    : 'bg-slate-800/50 backdrop-blur-sm text-slate-100 rounded-bl-none border border-slate-700 hover:border-slate-600'
                }`}
              >
                <p className="leading-relaxed text-sm sm:text-base">{message.content}</p>

                {message.role === 'assistant' && (
                  <>
                    {message.citations && message.citations.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-600">
                        <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                          Sources
                        </p>
                        <div className="space-y-2">
                          {message.citations.map((citation) => (
                            <button
                              key={citation.source}
                              type="button"
                              className="text-xs text-blue-400 hover:text-blue-300 hover:underline block transition-colors text-left w-full"
                            >
                              📎 {citation.source}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {message.confidence !== undefined && (
                      <div className="mt-3 pt-3 border-t border-slate-600 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all"
                            style={{ width: `${message.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 font-medium">
                          {(message.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start animate-fadeIn">
            <div className="bg-slate-800/50 backdrop-blur-sm text-slate-100 rounded-2xl rounded-bl-none p-4 border border-slate-700">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
                <span className="text-sm">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center animate-fadeIn">
            <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/50 text-red-200 rounded-2xl p-4 max-w-md flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700/50 p-3 bg-gradient-to-t from-slate-950 via-slate-900/90 to-slate-900/70 backdrop-blur-md shrink-0">
        <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-2">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 backdrop-blur-md shadow-xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                disabled={isLoading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e as unknown as React.FormEvent)
                  }
                }}
                placeholder="Ask anything about your documents..."
                className="w-full resize-none rounded-xl border border-slate-700/60 bg-slate-900/60 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:border-blue-500/70 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ minHeight: '48px', maxHeight: '160px' }}
              />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-slate-500 hidden sm:inline">{input.length}/1000</span>
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500 px-4 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:from-blue-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <Send className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 bg-slate-800/60 border border-slate-700 rounded text-slate-400 font-mono text-xs">↵</kbd>
              <span>Send</span>
              <span className="text-slate-600">•</span>
              <kbd className="px-2 py-1 bg-slate-800/60 border border-slate-700 rounded text-slate-400 font-mono text-xs">Shift↵</kbd>
              <span>New line</span>
            </div>
            <span className="text-xs text-slate-500 sm:hidden">{input.length}/1000</span>
          </div>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-track-slate-900::-webkit-scrollbar-track {
          background: rgba(15, 23, 42, 0.5);
          border-radius: 10px;
        }
        
        .scrollbar-thumb-slate-700::-webkit-scrollbar-thumb {
          background: rgba(51, 65, 85, 0.7);
          border-radius: 10px;
        }
        
        .scrollbar-thumb-slate-700::-webkit-scrollbar-thumb:hover {
          background: rgba(51, 65, 85, 0.9);
        }
      `}</style>
    </div>
  )
}

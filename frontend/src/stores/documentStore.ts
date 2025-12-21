import { create } from 'zustand'

export interface Document {
  id: string
  name: string
  size: number
  uploadedAt: string
  status: 'processing' | 'completed' | 'failed'
}

interface DocumentStore {
  documents: Document[]
  addDocument: (doc: Document) => void
  removeDocument: (id: string) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  fetchDocuments: () => Promise<void>
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  documents: [],

  addDocument: (doc) =>
    set((state) => ({
      documents: [...state.documents, doc],
    })),

  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((doc) => doc.id !== id),
    })),

  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, ...updates } : doc
      ),
    })),

  fetchDocuments: async () => {
    try {
      const response = await fetch('/api/documents')
      if (!response.ok) throw new Error('Failed to fetch documents')
      const data = await response.json()
      set({ documents: data })
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  },
}))

import axios, { AxiosInstance, AxiosError } from 'axios'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api'

class APIClient {
  private readonly client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    // Handle 401 responses
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('token')
          globalThis.location.href = '/auth'
        }
        return Promise.reject(error)
      }
    )
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.client.post('/auth/login', { email, password })
  }

  async register(email: string, name: string, password: string) {
    return this.client.post('/auth/register', { email, name, password })
  }

  // Query endpoints
  async submitQuery(query: string, documentIds?: string[]) {
    return this.client.post('/workflows/query', {
      query,
      documentIds,
      context: { userId: 'current-user' },
    })
  }

  // Document endpoints
  async uploadDocument(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return this.client.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }

  async getDocuments() {
    return this.client.get('/documents')
  }

  async deleteDocument(id: string) {
    return this.client.delete(`/documents/${id}`)
  }

  // Query history endpoints
  async getQueryHistory() {
    return this.client.get('/queries/history')
  }
}

export const apiClient = new APIClient()

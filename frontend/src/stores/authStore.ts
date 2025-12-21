import { create } from 'zustand'

interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  token: string
  role?: string
}

interface AuthStore {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, firstName: string, lastName: string, password: string) => Promise<void>
  logout: () => void
  setUser: (user: User, token: string) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || errorData.message || `Login failed (${response.status})`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const userData = {
        ...data.user,
        token: data.token,
      }
      set({
        user: userData,
        isAuthenticated: true,
      })

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(userData))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed. Make sure the backend is running on http://localhost:3000'
      console.error('Login error:', error)
      throw new Error(message)
    }
  },

  register: async (email: string, firstName: string, lastName: string, password: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, lastName, password }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const errorMessage = errorData.error || errorData.message || `Registration failed (${response.status})`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      const userData = {
        ...data.user,
        token: data.token,
      }
      set({
        user: userData,
        isAuthenticated: true,
      })

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(userData))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed. Make sure the backend is running on http://localhost:3000'
      console.error('Registration error:', error)
      throw new Error(message)
    }
  },

  logout: () => {
    set({ user: null, isAuthenticated: false })
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  },

  setUser: (user: User, token: string) => {
    set({
      user: { ...user, token },
      isAuthenticated: true,
    })
  },
}))

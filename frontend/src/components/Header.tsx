import React from 'react'
import { LogOut, Settings } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

function getUserDisplayName(user: any): string {
  if (!user) return 'User'
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName}`
  }
  return user.firstName || 'User'
}

export default function Header() {
  const { user, logout } = useAuthStore()

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <span className="text-white font-bold text-sm">RG</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">RAGentic</h1>
          <p className="text-xs text-slate-400">AI-Powered RAG System</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-white">
            {getUserDisplayName(user)}
          </p>
          <p className="text-xs text-slate-400">{user?.email}</p>
        </div>
        <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
          <Settings className="w-5 h-5 text-slate-400 hover:text-slate-300" />
        </button>
        <button
          onClick={() => logout()}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5 text-slate-400 hover:text-red-400" />
        </button>
      </div>
    </header>
  )
}

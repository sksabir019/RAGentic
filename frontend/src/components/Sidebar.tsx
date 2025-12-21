import React from 'react'
import { FileText, MessageSquare, Upload, BarChart3 } from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'

export default function Sidebar() {
  const location = useLocation()

  const navItems = [
    { name: 'Chat', path: '/', icon: MessageSquare },
    { name: 'Documents', path: '/documents', icon: FileText },
    { name: 'Upload', path: '/upload', icon: Upload },
    { name: 'Analytics', path: '/analytics', icon: BarChart3 },
  ]

  return (
    <aside className="w-64 bg-slate-900/50 border-r border-slate-700 p-6">
      <nav className="space-y-2">
        {navItems.map(({ name, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              location.pathname === path
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{name}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-8 pt-6 border-t border-slate-700">
        <p className="text-xs text-slate-500 font-semibold mb-4">SHORTCUTS</p>
        <div className="space-y-2">
          <button className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-slate-300 rounded-lg hover:bg-slate-800/50 transition-colors">
            Recent Documents
          </button>
          <button className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-slate-300 rounded-lg hover:bg-slate-800/50 transition-colors">
            Query History
          </button>
        </div>
      </div>
    </aside>
  )
}

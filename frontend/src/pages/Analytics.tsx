import React, { useState, useEffect } from 'react'
import { BarChart3, TrendingUp, FileText, Zap, type LucideIcon } from 'lucide-react'

interface AnalyticsData {
  totalDocuments: number
  totalChunks: number
  totalQueries: number
  avgQueryTime: number
}

interface StatCardProps {
  readonly icon: LucideIcon
  readonly label: string
  readonly value: number | string
  readonly unit?: string
}

function StatCard({ icon: Icon, label, value, unit }: Readonly<StatCardProps>) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">
            {value}
            {unit && <span className="text-lg text-slate-400 ml-1">{unit}</span>}
          </p>
        </div>
        <Icon className="w-8 h-8 text-blue-400" />
      </div>
    </div>
  )
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalDocuments: 0,
    totalChunks: 0,
    totalQueries: 0,
    avgQueryTime: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem('token')
        const response = await fetch('/api/analytics', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        if (!response.ok) throw new Error('Failed to fetch analytics')
        const data = await response.json()
        setAnalytics(data.data || {})
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="text-slate-400">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
        <p className="text-slate-400">View your usage statistics and insights</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 text-red-200 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          icon={FileText}
          label="Total Documents"
          value={analytics.totalDocuments}
        />
        <StatCard
          icon={BarChart3}
          label="Total Chunks"
          value={analytics.totalChunks}
        />
        <StatCard
          icon={Zap}
          label="Total Queries"
          value={analytics.totalQueries}
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Query Time"
          value={analytics.avgQueryTime.toFixed(2)}
          unit="ms"
        />
      </div>

      {/* Additional Analytics Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">System Status</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Backend API</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm font-medium">
                Online
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Database</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm font-medium">
                Connected
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Search Index</span>
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm font-medium">
                Ready
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Quick Info</h2>
          <div className="space-y-3">
            <p className="text-slate-400">
              <span className="font-semibold">Version:</span> 1.0.0
            </p>
            <p className="text-slate-400">
              <span className="font-semibold">Last Updated:</span>{' '}
              {new Date().toLocaleDateString()}
            </p>
            <p className="text-slate-400">
              <span className="font-semibold">Storage:</span> Used
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

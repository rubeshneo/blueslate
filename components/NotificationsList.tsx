'use client'

import { useEffect, useState } from 'react'
import { Check, Trash2, Info, AlertTriangle, CheckCircle, XCircle, Bell } from 'lucide-react'
import type { Notification } from '@/lib/redis'

const TYPE_COLOR: Record<string, string> = {
  info:    'var(--text-2)',
  success: 'var(--live)',
  warning: 'var(--warn)',
  error:   'var(--danger)',
}

const TYPE_ICONS = {
  info:    Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error:   XCircle,
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function NotificationsList() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/notifications', { signal: controller.signal })
      .then((r) => r.json())
      .then(({ data }) => { setNotifications(data ?? []); setLoading(false) })
      .catch((err) => { if (err.name !== 'AbortError') setLoading(false) })
    return () => controller.abort()
  }, [])

  const markAll = async () => {
    await fetch('/api/notifications', { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const markOne = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  const deleteOne = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  const displayed = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 card px-4 py-3">
        {/* Filter pills */}
        <div className="flex bg-[var(--surface-2)] border border-[var(--border)] rounded-md p-1 gap-1">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-[12px] font-medium rounded border-none cursor-pointer transition-all duration-150 ${
                filter === f
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-transparent text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--surface)]'
              }`}
            >
              {f === 'all' ? 'All' : 'Unread'}{f === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
            </button>
          ))}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAll}
            className="flex items-center gap-2 bg-transparent border-none cursor-pointer text-[12px] text-[var(--text-3)] font-medium transition-colors hover:text-[var(--accent)] p-0"
          >
            <Check size={13} /> Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="font-body py-12 text-center text-[var(--text-3)] text-[12px] animate-pulse">
          Loading…
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-20 text-center card">
          <Bell size={32} className="text-[var(--border-strong)] mx-auto mb-4 opacity-50" />
          <p className="font-body text-[13px] text-[var(--text-3)]">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map((n, idx) => {
            const Icon = TYPE_ICONS[n.type] ?? Info
            const iconColor = TYPE_COLOR[n.type] ?? 'var(--text-2)'
            return (
              <div
                key={n.id}
                className={`card p-5 flex gap-4 transition-all duration-200 group/notif animate-[fade-up_0.4s_both_ease] ${!n.read ? 'border-l-4 border-l-[var(--accent)]' : ''}`}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {/* Icon */}
                <div className="mt-0.5 shrink-0">
                  <Icon size={17} style={{ color: iconColor }} />
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-[13px] font-semibold ${n.read ? 'text-[var(--text-2)]' : 'text-[var(--text-1)]'}`}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-1.5 h-1.5 bg-[var(--accent)] shrink-0 rounded-full" />
                        )}
                      </div>
                      <p className="text-[13px] text-[var(--text-2)] mt-1 leading-relaxed">
                        {n.message}
                      </p>
                      <p className="text-[11px] text-[var(--text-3)] mt-2">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover/notif:opacity-100 transition-opacity">
                      {!n.read && (
                        <button
                          onClick={() => markOne(n.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-transparent border border-[var(--border)] rounded-md text-[var(--text-2)] cursor-pointer transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
                        >
                          <Check size={11} /> Read
                        </button>
                      )}
                      <button
                        onClick={() => deleteOne(n.id)}
                        className="flex items-center justify-center w-8 h-8 bg-transparent border border-[var(--border)] rounded-md text-[var(--text-3)] cursor-pointer transition-all hover:border-[var(--danger)] hover:text-[var(--danger)]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

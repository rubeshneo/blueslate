'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Check, Info, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react'
import type { Notification } from '@/lib/redis'

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

const TYPE_COLOR: Record<string, string> = {
  info:    'var(--text-3)',
  success: 'var(--live)',
  warning: 'var(--warn)',
  error:   'var(--danger)',
}

const TYPE_ICON = {
  info:    Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error:   XCircle,
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const unread = notifications.filter((n) => !n.read).length

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const { data } = await res.json()
        setNotifications(data ?? [])
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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

  const preview = notifications.slice(0, 6)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`relative flex items-center justify-center w-8 h-8 rounded-md border transition-all duration-150 shrink-0 ${
          open
            ? 'border-[var(--accent)] bg-[var(--surface-2)] text-[var(--accent)]'
            : 'border-[var(--border)] bg-transparent text-[var(--text-2)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]'
        }`}
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--accent)] border-2 border-[var(--surface)] rounded-full flex items-center justify-center">
            <span className="text-white text-[9px] font-bold leading-none">{unread > 9 ? '9+' : unread}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-80 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-[var(--shadow-lg)] z-50 animate-[slide-down_0.15s_ease_both] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)]">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--text-1)]">Notifications</span>
              {unread > 0 && (
                <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-[var(--accent)] text-white text-[10px] font-bold">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAll}
                className="flex items-center gap-1 text-[12px] text-[var(--text-3)] hover:text-[var(--accent)] transition-colors bg-transparent border-none cursor-pointer p-0"
              >
                <Check size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[320px] overflow-y-auto">
            {preview.length === 0 ? (
              <div className="py-10 px-4 text-center text-[13px] text-[var(--text-3)]">
                No notifications yet
              </div>
            ) : (
              preview.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Info
                const iconColor = TYPE_COLOR[n.type] ?? 'var(--text-3)'
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markOne(n.id)}
                    className={`flex gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0 transition-colors group/notif ${
                      n.read
                        ? 'cursor-default'
                        : 'cursor-pointer hover:bg-[var(--surface-2)] border-l-2 border-l-[var(--accent)]'
                    }`}
                  >
                    <Icon size={14} style={{ color: iconColor }} className="shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[13px] font-medium truncate ${n.read ? 'text-[var(--text-2)]' : 'text-[var(--text-1)]'}`}>
                          {n.title}
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!n.read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteOne(n.id) }}
                            className="bg-transparent border-none cursor-pointer text-[var(--text-3)] p-0 flex transition-colors hover:text-[var(--danger)]"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                      <p className="text-[12px] text-[var(--text-2)] mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-[var(--text-3)] mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--surface-2)] text-center">
            <a
              href="/notifications"
              className="text-[12px] font-medium text-[var(--accent)] no-underline hover:underline"
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

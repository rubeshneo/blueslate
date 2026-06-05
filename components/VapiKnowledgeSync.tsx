'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Zap } from 'lucide-react'

export default function VapiKnowledgeSync() {
  const [state, setState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function sync() {
    setState('syncing')
    setMessage('')
    try {
      const res = await fetch('/api/vapi/sync', { method: 'POST' })
      const json = await res.json() as { success?: boolean; sourceCount?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      setMessage(`${json.sourceCount} knowledge source${json.sourceCount === 1 ? '' : 's'} pushed to Vapi`)
      setState('success')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to sync')
      setState('error')
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
        boxShadow: 'var(--shadow-hard)',
        padding: '20px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '20px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: 0 }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            background: 'var(--accent-tint)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderRadius: '6px',
          }}
        >
          <Zap size={16} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <p
            className="font-display font-bold uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-1)' }}
          >
            Sync Knowledge → Live Calls
          </p>
          <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px', lineHeight: 1.5 }}>
            Push your scraped knowledge base into the Vapi assistant&apos;s system prompt so real phone calls use the latest data. Happens automatically on every scrape — use this button for a manual refresh.
          </p>
          {message && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '10px',
                fontSize: '12px',
                color: state === 'error' ? 'var(--danger)' : 'var(--live)',
              }}
            >
              {state === 'success'
                ? <CheckCircle2 size={13} />
                : <AlertCircle size={13} />}
              <span className="font-body">{message}</span>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={sync}
        disabled={state === 'syncing'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 20px',
          background: state === 'success' ? 'var(--live)' : state === 'error' ? 'var(--danger)' : 'var(--accent)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: state === 'syncing' ? 'not-allowed' : 'pointer',
          opacity: state === 'syncing' ? 0.7 : 1,
          flexShrink: 0,
          transition: 'all 0.15s',
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.02em',
          whiteSpace: 'nowrap',
        }}
      >
        <RefreshCw
          size={13}
          style={{ animation: state === 'syncing' ? 'spin 1s linear infinite' : 'none' }}
        />
        {state === 'syncing' ? 'Syncing…' : state === 'success' ? 'Synced!' : state === 'error' ? 'Retry' : 'Sync Now'}
      </button>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Zap, Phone, Loader2 } from 'lucide-react'

type StatusData = {
  provisioned:  boolean
  assistantId:  string | null
  phoneNumber:  string | null
  phoneNumberId: string | null
}

type ActionState = 'idle' | 'loading' | 'success' | 'error'

export default function VapiKnowledgeSync() {
  const [status,        setStatus]        = useState<StatusData | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const [provisionState,  setProvisionState]  = useState<ActionState>('idle')
  const [syncState,       setSyncState]       = useState<ActionState>('idle')
  const [actionMessage,   setActionMessage]   = useState('')

  // ── Fetch provisioning status on mount ────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch('/api/vapi/status')
        const data = await res.json() as StatusData
        setStatus(data)
      } catch {
        setStatus(null)
      } finally {
        setStatusLoading(false)
      }
    })()
  }, [])

  // ── Provision ─────────────────────────────────────────────────────────────
  async function provision() {
    setProvisionState('loading')
    setActionMessage('')
    try {
      const res  = await fetch('/api/vapi/provision', { method: 'POST' })
      const json = await res.json() as { success?: boolean; phoneNumber?: string; assistantId?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Provisioning failed')
      setStatus({
        provisioned:   true,
        assistantId:   json.assistantId ?? null,
        phoneNumber:   json.phoneNumber ?? null,
        phoneNumberId: null,
      })
      setActionMessage(`Your AI number is ready: ${json.phoneNumber ?? ''}`)
      setProvisionState('success')
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Provisioning failed')
      setProvisionState('error')
    }
  }

  // ── Sync knowledge ────────────────────────────────────────────────────────
  async function sync() {
    setSyncState('loading')
    setActionMessage('')
    try {
      const res  = await fetch('/api/vapi/sync', { method: 'POST' })
      const json = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      setActionMessage('Knowledge pushed to your AI assistant')
      setSyncState('success')
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : 'Sync failed')
      setSyncState('error')
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background:   'var(--surface)',
    border:       '1px solid var(--border)',
    borderLeft:   '3px solid var(--accent)',
    boxShadow:    'var(--shadow-hard)',
    padding:      '20px',
    display:      'flex',
    alignItems:   'flex-start',
    justifyContent: 'space-between',
    gap:          '20px',
    flexWrap:     'wrap',
  }

  const iconBox: React.CSSProperties = {
    width:           '36px',
    height:          '36px',
    background:      'var(--accent-tint)',
    border:          '1px solid var(--border)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
    borderRadius:    '6px',
  }

  function actionBtn(state: ActionState, color?: string): React.CSSProperties {
    return {
      display:     'flex',
      alignItems:  'center',
      gap:         '8px',
      padding:     '10px 20px',
      background:  state === 'success' ? 'var(--live)'
        : state === 'error'   ? 'var(--danger)'
        : color ?? 'var(--accent)',
      color:       'white',
      border:      'none',
      borderRadius: '6px',
      fontSize:    '12px',
      fontWeight:  600,
      cursor:      state === 'loading' ? 'not-allowed' : 'pointer',
      opacity:     state === 'loading' ? 0.7 : 1,
      flexShrink:  0,
      transition:  'all 0.15s',
      fontFamily:  'var(--font-display)',
      letterSpacing: '0.02em',
      whiteSpace:  'nowrap',
    }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (statusLoading) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={iconBox}>
            <Loader2 size={16} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
          </div>
          <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)' }}>
            Loading AI phone status…
          </p>
        </div>
      </div>
    )
  }

  // ── Not provisioned — show Get Your AI Number card ────────────────────────
  if (!status?.provisioned) {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: 0 }}>
          <div style={iconBox}>
            <Phone size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <p
              className="font-display font-bold uppercase"
              style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-1)' }}
            >
              Get Your AI Phone Number
            </p>
            <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px', lineHeight: 1.5 }}>
              Provision a dedicated AI assistant and phone number for your franchise. Every inbound call goes to your AI receptionist — 24/7.
            </p>
            {actionMessage && (
              <div
                style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        '6px',
                  marginTop:  '10px',
                  fontSize:   '12px',
                  color: provisionState === 'error' ? 'var(--danger)' : 'var(--live)',
                }}
              >
                {provisionState === 'success'
                  ? <CheckCircle2 size={13} />
                  : <AlertCircle  size={13} />}
                <span className="font-body">{actionMessage}</span>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={() => void provision()}
          disabled={provisionState === 'loading'}
          style={actionBtn(provisionState)}
        >
          {provisionState === 'loading'
            ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            : <Phone size={13} />}
          {provisionState === 'loading' ? 'Provisioning…'
            : provisionState === 'success' ? 'Provisioned!'
            : provisionState === 'error'   ? 'Retry'
            : 'Get AI Number'}
        </button>
      </div>
    )
  }

  // ── Provisioned — show phone number + Sync Knowledge button ───────────────
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: 0 }}>
        <div style={iconBox}>
          <Zap size={16} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <p
            className="font-display font-bold uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-1)' }}
          >
            AI Receptionist Active
          </p>
          {status.phoneNumber && (
            <p
              className="font-display font-bold"
              style={{ fontSize: '18px', letterSpacing: '-0.01em', color: 'var(--accent)', marginTop: '4px' }}
            >
              {status.phoneNumber}
            </p>
          )}
          <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px', lineHeight: 1.5 }}>
            Push your latest scraped knowledge into the AI assistant&apos;s system prompt. Happens automatically on every scrape — use this for a manual refresh.
          </p>
          {actionMessage && (
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        '6px',
                marginTop:  '10px',
                fontSize:   '12px',
                color: syncState === 'error' ? 'var(--danger)' : 'var(--live)',
              }}
            >
              {syncState === 'success'
                ? <CheckCircle2 size={13} />
                : <AlertCircle  size={13} />}
              <span className="font-body">{actionMessage}</span>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => void sync()}
        disabled={syncState === 'loading'}
        style={actionBtn(syncState)}
      >
        <RefreshCw
          size={13}
          style={{ animation: syncState === 'loading' ? 'spin 1s linear infinite' : 'none' }}
        />
        {syncState === 'loading' ? 'Syncing…'
          : syncState === 'success' ? 'Synced!'
          : syncState === 'error'   ? 'Retry'
          : 'Sync Knowledge'}
      </button>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import {
  RefreshCw, CheckCircle2, AlertCircle, Zap, Phone,
  Loader2, Plus, ArrowLeft, Copy, Check,
} from 'lucide-react'

type StatusData = {
  provisioned:   boolean
  assistantId:   string | null
  phoneNumber:   string | null
  phoneNumberId: string | null
}

type View = 'loading' | 'choose' | 'form_twilio' | 'form_vapi' | 'provisioned'
type ActionState = 'idle' | 'loading' | 'error'

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border:     '1px solid var(--border)',
  borderLeft: '3px solid var(--accent)',
  boxShadow:  'var(--shadow-hard)',
  padding:    '20px',
}

const iconBox: React.CSSProperties = {
  width:          '36px',
  height:         '36px',
  background:     'var(--accent-tint)',
  border:         '1px solid var(--border)',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  flexShrink:     0,
  borderRadius:   '6px',
}

function btn(color = 'var(--accent)', disabled = false): React.CSSProperties {
  return {
    display:       'flex',
    alignItems:    'center',
    gap:           '8px',
    padding:       '10px 20px',
    background:    color,
    color:         'white',
    border:        'none',
    borderRadius:  '6px',
    fontSize:      '12px',
    fontWeight:    600,
    cursor:        disabled ? 'not-allowed' : 'pointer',
    opacity:       disabled ? 0.6 : 1,
    transition:    'opacity 0.15s',
    fontFamily:    'var(--font-display)',
    letterSpacing: '0.02em',
    whiteSpace:    'nowrap',
  }
}

function input(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    width:        '100%',
    padding:      '9px 12px',
    background:   'var(--surface-2)',
    border:       '1px solid var(--border)',
    borderRadius: '6px',
    fontSize:     '12px',
    color:        'var(--text-1)',
    outline:      'none',
    fontFamily:   'var(--font-display)',
    ...extra,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function VapiKnowledgeSync() {
  const [view,           setView]          = useState<View>('loading')
  const [status,         setStatus]        = useState<StatusData | null>(null)
  const [actionState,    setActionState]   = useState<ActionState>('idle')
  const [errorMsg,       setErrorMsg]      = useState('')
  const [syncState,      setSyncState]     = useState<ActionState>('idle')
  const [syncMsg,        setSyncMsg]       = useState('')
  const [copied,         setCopied]        = useState(false)
  const [showForwarding, setShowForwarding]= useState(false)

  // Twilio form
  const [sid,    setSid]    = useState('')
  const [token,  setToken]  = useState('')
  const [tnum,   setTnum]   = useState('')
  // Vapi form
  const [vapiId, setVapiId] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch('/api/vapi/status')
        const data = await res.json() as StatusData
        setStatus(data)
        setView(data.provisioned ? 'provisioned' : 'choose')
      } catch {
        setView('choose')
      }
    })()
  }, [])

  async function provision(body: Record<string, string>) {
    setActionState('loading')
    setErrorMsg('')
    try {
      const res  = await fetch('/api/vapi/provision', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json() as { success?: boolean; phoneNumber?: string; assistantId?: string; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Provisioning failed')
      setStatus({ provisioned: true, assistantId: json.assistantId ?? null, phoneNumber: json.phoneNumber ?? null, phoneNumberId: null })
      setView('provisioned')
      setActionState('idle')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Provisioning failed')
      setActionState('error')
    }
  }

  async function sync() {
    setSyncState('loading')
    setSyncMsg('')
    try {
      const res  = await fetch('/api/vapi/sync', { method: 'POST' })
      const json = await res.json() as { success?: boolean; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Sync failed')
      setSyncMsg('Knowledge pushed to your AI assistant')
      setSyncState('idle')
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Sync failed')
      setSyncState('error')
    }
  }

  function copyNumber() {
    if (!status?.phoneNumber) return
    void navigator.clipboard.writeText(status.phoneNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (view === 'loading') {
    return (
      <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={iconBox}><Loader2 size={16} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} /></div>
        <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)' }}>Checking AI phone status…</p>
      </div>
    )
  }

  // ── Choose mode ───────────────────────────────────────────────────────────────
  if (view === 'choose') {
    const modes = [
      {
        id:    'new',
        icon:  <Plus size={18} style={{ color: 'var(--accent)' }} />,
        title: 'Get a new AI number',
        desc:  'Blueslate provisions a dedicated phone number for your franchise. Fastest setup.',
        onClick: () => void provision({ mode: 'new' }),
      },
      {
        id:    'twilio',
        icon:  <Phone size={18} style={{ color: '#F22F46' }} />,
        title: 'Use my existing Twilio number',
        desc:  'Import a Twilio number you already own. Your existing customers keep calling the same number.',
        onClick: () => { setView('form_twilio'); setActionState('idle'); setErrorMsg('') },
      },
      {
        id:    'vapi',
        icon:  <Zap size={18} style={{ color: '#6366F1' }} />,
        title: 'Use my existing Vapi number',
        desc:  'Link a Vapi phone number ID you already have. A new AI assistant will be created and linked.',
        onClick: () => { setView('form_vapi'); setActionState('idle'); setErrorMsg('') },
      },
    ]

    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
          <div style={iconBox}><Phone size={16} style={{ color: 'var(--accent)' }} /></div>
          <div>
            <p className="font-display font-bold uppercase" style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-1)' }}>
              Set Up Your AI Phone Line
            </p>
            <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>
              Every inbound and outbound call goes through your dedicated AI receptionist.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={actionState === 'loading' ? undefined : m.onClick}
              disabled={actionState === 'loading'}
              style={{
                display:       'flex',
                alignItems:    'center',
                gap:           '14px',
                padding:       '14px 16px',
                background:    'var(--surface-2)',
                border:        '1px solid var(--border)',
                borderRadius:  '8px',
                cursor:        actionState === 'loading' ? 'not-allowed' : 'pointer',
                textAlign:     'left',
                transition:    'border-color 0.15s',
                opacity:       actionState === 'loading' && m.id !== 'new' ? 0.5 : 1,
              }}
            >
              <div style={{ width: '36px', height: '36px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {actionState === 'loading' && m.id === 'new'
                  ? <Loader2 size={16} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
                  : m.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p className="font-display font-bold" style={{ fontSize: '12px', color: 'var(--text-1)' }}>{m.title}</p>
                <p className="font-body" style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', lineHeight: 1.4 }}>{m.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {errorMsg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', fontSize: '12px', color: 'var(--danger)' }}>
            <AlertCircle size={13} /><span className="font-body">{errorMsg}</span>
          </div>
        )}
      </div>
    )
  }

  // ── Twilio form ───────────────────────────────────────────────────────────────
  if (view === 'form_twilio') {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <button onClick={() => setView('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 0 }}>
            <ArrowLeft size={15} />
          </button>
          <p className="font-display font-bold uppercase" style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-1)' }}>
            Import Twilio Number
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label className="font-display font-bold uppercase" style={{ fontSize: '9px', letterSpacing: '0.16em', color: 'var(--text-3)', display: 'block', marginBottom: '5px' }}>
              Twilio Account SID
            </label>
            <input style={input()} value={sid} onChange={e => setSid(e.target.value)} placeholder="AC..." />
          </div>
          <div>
            <label className="font-display font-bold uppercase" style={{ fontSize: '9px', letterSpacing: '0.16em', color: 'var(--text-3)', display: 'block', marginBottom: '5px' }}>
              Auth Token
            </label>
            <input style={input()} type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="Your Twilio auth token" />
          </div>
          <div>
            <label className="font-display font-bold uppercase" style={{ fontSize: '9px', letterSpacing: '0.16em', color: 'var(--text-3)', display: 'block', marginBottom: '5px' }}>
              Phone Number
            </label>
            <input style={input()} value={tnum} onChange={e => setTnum(e.target.value)} placeholder="+15551112222" />
          </div>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--danger)' }}>
              <AlertCircle size={13} /><span className="font-body">{errorMsg}</span>
            </div>
          )}

          <button
            onClick={() => void provision({ mode: 'twilio', twilioAccountSid: sid, twilioAuthToken: token, twilioNumber: tnum })}
            disabled={actionState === 'loading' || !sid || !token || !tnum}
            style={btn('var(--accent)', actionState === 'loading' || !sid || !token || !tnum)}
          >
            {actionState === 'loading' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Phone size={13} />}
            {actionState === 'loading' ? 'Importing…' : 'Import & Create AI'}
          </button>
        </div>
      </div>
    )
  }

  // ── Vapi existing form ────────────────────────────────────────────────────────
  if (view === 'form_vapi') {
    return (
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <button onClick={() => setView('choose')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 0 }}>
            <ArrowLeft size={15} />
          </button>
          <p className="font-display font-bold uppercase" style={{ fontSize: '11px', letterSpacing: '0.12em', color: 'var(--text-1)' }}>
            Use Existing Vapi Number
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <label className="font-display font-bold uppercase" style={{ fontSize: '9px', letterSpacing: '0.16em', color: 'var(--text-3)', display: 'block', marginBottom: '5px' }}>
              Vapi Phone Number ID
            </label>
            <input style={input()} value={vapiId} onChange={e => setVapiId(e.target.value)} placeholder="e.g. 3f8a1b2c-..." />
            <p className="font-body" style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '4px' }}>
              Find this in dashboard.vapi.ai → Phone Numbers → your number → ID
            </p>
          </div>

          {errorMsg && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--danger)' }}>
              <AlertCircle size={13} /><span className="font-body">{errorMsg}</span>
            </div>
          )}

          <button
            onClick={() => void provision({ mode: 'vapi_existing', vapiPhoneNumberId: vapiId })}
            disabled={actionState === 'loading' || !vapiId}
            style={btn('var(--accent)', actionState === 'loading' || !vapiId)}
          >
            {actionState === 'loading' ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
            {actionState === 'loading' ? 'Linking…' : 'Link Number & Create AI'}
          </button>
        </div>
      </div>
    )
  }

  // ── Provisioned: number card + sync + forwarding instructions ─────────────────
  const phoneNumber = status?.phoneNumber ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Phone number card */}
      <div style={{ ...card, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
          <div style={{ ...iconBox, borderLeftColor: 'var(--live)', borderColor: 'var(--live)', background: 'rgba(0,232,122,0.08)' }}>
            <Phone size={16} style={{ color: 'var(--live)' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <span style={{ width: '6px', height: '6px', background: 'var(--live)', borderRadius: '50%', animation: 'live-dot 2s ease-in-out infinite', display: 'inline-block' }} />
              <p className="font-display font-bold uppercase" style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--live)' }}>AI Receptionist Active</p>
            </div>
            <p className="font-display font-bold" style={{ fontSize: '22px', letterSpacing: '-0.01em', color: 'var(--text-1)' }}>
              {phoneNumber}
            </p>
            <p className="font-body" style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
              This is your dedicated AI phone line — share it with customers or forward your existing number here.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={copyNumber}
            style={btn(copied ? 'var(--live)' : 'var(--surface-2)')}
          >
            {copied
              ? <><Check size={13} style={{ color: 'white' }} /><span style={{ color: 'white' }}>Copied!</span></>
              : <><Copy size={13} style={{ color: 'var(--text-2)' }} /><span style={{ color: 'var(--text-2)' }}>Copy</span></>}
          </button>

          <button
            onClick={() => void sync()}
            disabled={syncState === 'loading'}
            style={btn(syncState === 'error' ? 'var(--danger)' : 'var(--accent)', syncState === 'loading')}
          >
            <RefreshCw size={13} style={{ animation: syncState === 'loading' ? 'spin 1s linear infinite' : 'none' }} />
            {syncState === 'loading' ? 'Syncing…' : syncState === 'error' ? 'Retry Sync' : 'Sync Knowledge'}
          </button>
        </div>

        {syncMsg && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: syncState === 'error' ? 'var(--danger)' : 'var(--live)' }}>
            {syncState === 'error' ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
            <span className="font-body">{syncMsg}</span>
          </div>
        )}
      </div>

      {/* Call forwarding instructions */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-hard)', overflow: 'hidden' }}>
        <button
          onClick={() => setShowForwarding(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Phone size={13} style={{ color: 'var(--text-3)' }} />
            <p className="font-display font-bold uppercase" style={{ fontSize: '10px', letterSpacing: '0.14em', color: 'var(--text-2)' }}>
              Already have a number customers know? Forward it here
            </p>
          </div>
          <span className="font-display" style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 700 }}>
            {showForwarding ? 'Hide' : 'Show instructions'}
          </span>
        </button>

        {showForwarding && (
          <div style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--border)' }}>
            <p className="font-body" style={{ fontSize: '11px', color: 'var(--text-3)', marginBottom: '14px', lineHeight: 1.6 }}>
              Set up call forwarding on your existing number to route all calls to your AI receptionist. Takes 2 minutes — your customers keep calling the same number they already know.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { carrier: 'AT&T / Most US carriers',  instruction: `Dial  *72${phoneNumber}  then press Call` },
                { carrier: 'Verizon',                  instruction: 'Settings → Calls → Call Forwarding → Always Forward → enter your AI number' },
                { carrier: 'T-Mobile',                 instruction: 'Settings → More → Call Forwarding → Always Forward → enter your AI number' },
                { carrier: 'Twilio (existing number)', instruction: 'Console → Phone Numbers → your number → Voice → A Call Comes In → Forward to → enter your AI number' },
                { carrier: 'Google Voice',             instruction: 'Settings → Calls → Forward calls → add your AI number' },
              ].map(({ carrier, instruction }) => (
                <div key={carrier} style={{ display: 'flex', gap: '12px', padding: '10px 12px', background: 'var(--surface-2)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <p className="font-display font-bold" style={{ fontSize: '10px', color: 'var(--accent)', minWidth: '130px', flexShrink: 0 }}>{carrier}</p>
                  <p className="font-body" style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5 }}>{instruction}</p>
                </div>
              ))}
            </div>
            <p className="font-body" style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '12px' }}>
              All carriers support call forwarding. Check your carrier&apos;s website if the steps above don&apos;t match your interface.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

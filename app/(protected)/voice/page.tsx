export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase'
import { getTenantId } from '@/lib/get-tenant'
import { Phone, Mic, Clock, CheckCircle2, AlertCircle, Radio } from 'lucide-react'
import VapiKnowledgeSync from '@/components/VapiKnowledgeSync'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL

const STATUS_COLOR: Record<string, string> = {
  completed:     'var(--live)',
  'in-progress': 'var(--warn)',
  missed:        'var(--warn)',
  failed:        'var(--danger)',
  spam:          'var(--text-3)',
}

const STATUS_BG: Record<string, string> = {
  completed:     'rgba(0,232,122,0.08)',
  'in-progress': 'rgba(255,170,0,0.08)',
  missed:        'rgba(255,170,0,0.08)',
  failed:        'rgba(255,51,51,0.08)',
  spam:          'rgba(150,150,150,0.1)',
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

type CallLog = {
  id: string
  vapi_call_id: string | null
  caller_number: string | null
  started_at: string | null
  duration_seconds: number | null
  status: string
  created_at: string
}

export default async function VoicePage() {
  const tenantId = await getTenantId()

  // Fetch tenant info for the assistant ID card
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('vapi_agent_id, vapi_phone_number')
    .eq('id', tenantId)
    .maybeSingle()

  const tenantAssistantId = (tenant?.vapi_agent_id as string | null) ?? null

  const { data: callLogs, error } = await supabaseAdmin
    .from('call_logs')
    .select('id, vapi_call_id, caller_number, started_at, duration_seconds, status')
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('VOICE PAGE CALL LOGS ERROR:', error)
  }

  const logs = (callLogs || []) as CallLog[]
  const webhookUrl = `${APP_URL}/api/webhooks/vapi`
  const isLocalhost = APP_URL?.includes('localhost')

  return (
    <main
      className="flex-1 stagger"
      style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {/* Status cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>

        {/* Live status */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid var(--live)',
            boxShadow: 'var(--shadow-hard)',
            padding: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ width: '6px', height: '6px', background: 'var(--live)', animation: 'live-dot 2s ease-in-out infinite' }} />
            <span
              className="font-display font-bold uppercase"
              style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--live)' }}
            >
              Live
            </span>
          </div>
          <p
            className="font-display font-bold uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-1)' }}
          >
            AI Receptionist
          </p>
          <p className="font-body" style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
            Vapi voice agent active and ready to answer calls
          </p>
        </div>

        {/* Assistant ID */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-hard)',
            padding: '18px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
            }}
          >
            <Mic size={12} style={{ color: 'var(--accent)' }} />
          </div>
          <p
            className="font-display font-bold uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-1)' }}
          >
            Assistant ID
          </p>
          <p
            className="font-display"
            style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '5px', wordBreak: 'break-all', lineHeight: 1.4 }}
          >
            {tenantAssistantId ?? 'Not provisioned yet'}
          </p>
        </div>

        {/* Total calls */}
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-hard)',
            padding: '18px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
            }}
          >
            <Radio size={12} style={{ color: 'var(--accent)' }} />
          </div>
          <p
            className="font-display font-bold uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.1em', color: 'var(--text-1)' }}
          >
            Total Calls
          </p>
          <p
            className="font-display font-bold"
            style={{ fontSize: '28px', letterSpacing: '-0.02em', color: 'var(--text-1)', marginTop: '4px', lineHeight: 1 }}
          >
            {logs.length}
          </p>
        </div>
      </div>

      {/* Provisioning + Knowledge → Vapi sync */}
      <VapiKnowledgeSync />

      {/* Webhook config */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-hard)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
          }}
        >
          <p
            className="font-display font-bold uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.22em', color: 'var(--text-3)' }}
          >
            ── Vapi Webhook Configuration
          </p>
          <p className="font-body" style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '3px' }}>
            Configure in your Vapi dashboard to auto-parse leads after each call
          </p>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLocalhost && (
            <div
              className="font-body"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                border: '1px solid var(--warn)',
                padding: '12px 14px',
                fontSize: '11px',
                color: 'var(--warn)',
              }}
            >
              <span style={{ fontSize: '13px', lineHeight: 1, marginTop: '1px' }}>⚠</span>
              <div>
                <p className="font-display font-bold uppercase" style={{ fontSize: '9px', letterSpacing: '0.16em', marginBottom: '4px' }}>
                  Localhost detected — Vapi cannot reach this
                </p>
                <p>Use <span style={{ fontFamily: 'var(--font-display)' }}>ngrok http 3000</span> for local testing, or deploy to Vercel.</p>
              </div>
            </div>
          )}

          <div>
            <p
              className="font-display font-bold uppercase"
              style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '8px' }}
            >
              Server URL (Vapi → Assistant → Server URL)
            </p>
            <div
              className="font-display"
              style={{
                padding: '12px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                fontSize: '11px',
                color: 'var(--text-1)',
                wordBreak: 'break-all',
                lineHeight: 1.5,
              }}
            >
              {webhookUrl}
            </div>
          </div>

          {logs.length === 0 ? (
            <div>
              <p
                className="font-display font-bold uppercase"
                style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'var(--text-3)', marginBottom: '10px' }}
              >
                Setup Steps
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {[
                  'Provision your AI number above (one click)',
                  `Set Server URL in Vapi dashboard to: ${webhookUrl}`,
                  'Enable "End of Call Report" in Server Events',
                  'Assign your provisioned phone number to the assistant',
                  'Route your business phone to your AI number',
                ].map((text, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '10px 0',
                      borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span
                      className="font-display font-bold"
                      style={{
                        width: '18px',
                        height: '18px',
                        background: 'var(--accent)',
                        color: 'var(--bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        flexShrink: 0,
                        letterSpacing: '0.04em',
                        marginTop: '1px',
                      }}
                    >
                      {i + 1}
                    </span>
                    <span className="font-body" style={{ fontSize: '11px', color: 'var(--text-2)', lineHeight: 1.5 }}>
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--live)' }} />
              <span className="font-display font-bold uppercase" style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'var(--live)' }}>
                Webhook Successfully Connected
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Call logs table */}
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-hard)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <p
            className="font-display font-bold uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.22em', color: 'var(--text-3)' }}
          >
            ── Recent Calls
          </p>
          <span
            className="font-display font-bold uppercase"
            style={{ fontSize: '9px', letterSpacing: '0.14em', color: 'var(--text-3)' }}
          >
            {logs.length} logged
          </span>
        </div>

        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Phone size={28} style={{ color: 'var(--border-strong)', margin: '0 auto 12px', opacity: 0.5 }} />
            <p className="font-body" style={{ fontSize: '12px', color: 'var(--text-3)' }}>No calls logged yet</p>
            <p className="font-body" style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
              Calls appear automatically after Vapi webhook is configured
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  {['Caller', 'Date', 'Duration', 'Status'].map((h) => (
                    <th
                      key={h}
                      className="font-display font-bold uppercase"
                      style={{
                        textAlign: 'left',
                        padding: '10px 20px',
                        fontSize: '9px',
                        letterSpacing: '0.18em',
                        color: 'var(--text-3)',
                        fontWeight: 700,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => {
                  const isSpam = log.status === 'completed' && log.duration_seconds !== null && log.duration_seconds < 10
                  const statusLabel = isSpam ? 'spam' : log.status
                  const color = STATUS_COLOR[statusLabel] ?? 'var(--text-2)'
                  const bg = STATUS_BG[statusLabel] ?? 'transparent'
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-[var(--surface-2)] transition-colors duration-100"
                      style={{
                        borderBottom: idx < logs.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <td
                        className="font-display"
                        style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-1)' }}
                      >
                        {log.caller_number || (
                          <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>Unknown</span>
                        )}
                      </td>
                      <td
                        className="font-body"
                        style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-2)' }}
                      >
                        {log.started_at
                          ? new Date(log.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                          : 'Unknown Date'}
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span
                          className="font-body"
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-2)' }}
                        >
                          <Clock size={10} style={{ color: 'var(--text-3)' }} />
                          {formatDuration(log.duration_seconds)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span
                          className="font-display font-bold uppercase"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            fontSize: '8px',
                            letterSpacing: '0.14em',
                            background: bg,
                            border: `1px solid ${color}`,
                            color,
                          }}
                        >
                          {statusLabel === 'completed' && <CheckCircle2 size={9} />}
                          {statusLabel === 'failed' && <AlertCircle size={9} />}
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}

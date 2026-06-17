'use client'

import { useState } from 'react'
import { Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

/* ── Types ─────────────────────────────────────────────────────────────────── */

type DayHours = { enabled: boolean; open: string; close: string }

type BusinessHours = {
  timezone:            string
  hours: Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayHours>
  after_hours_message: string
}

const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Phoenix', 'America/Anchorage', 'Pacific/Honolulu',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
]

const DEFAULT_HOURS: BusinessHours = {
  timezone: 'America/Chicago',
  hours: {
    mon: { enabled: true,  open: '09:00', close: '18:00' },
    tue: { enabled: true,  open: '09:00', close: '18:00' },
    wed: { enabled: true,  open: '09:00', close: '18:00' },
    thu: { enabled: true,  open: '09:00', close: '18:00' },
    fri: { enabled: true,  open: '09:00', close: '17:00' },
    sat: { enabled: false, open: '10:00', close: '14:00' },
    sun: { enabled: false, open: '10:00', close: '14:00' },
  },
  after_hours_message: "We're currently closed but your call matters to us. Our team will follow up with you during business hours.",
}

function mergeDefaults(saved: Partial<BusinessHours> | null): BusinessHours {
  if (!saved) return DEFAULT_HOURS
  return {
    ...DEFAULT_HOURS,
    ...saved,
    hours: { ...DEFAULT_HOURS.hours, ...(saved.hours ?? {}) },
  }
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export default function BusinessHoursCard({
  initialHours,
}: {
  initialHours: Partial<BusinessHours> | null
}) {
  const [form, setForm]     = useState<BusinessHours>(mergeDefaults(initialHours))
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const setDay = (day: (typeof DAY_KEYS)[number], field: keyof DayHours, value: string | boolean) => {
    setForm(prev => ({
      ...prev,
      hours: { ...prev.hours, [day]: { ...prev.hours[day], [field]: value } },
    }))
    setStatus('idle')
  }

  const handleSave = async () => {
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/settings/business-hours', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Save failed')
      }
      setStatus('saved')
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Save failed')
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center flex-shrink-0">
          <Clock size={16} className="text-[var(--accent)]" />
        </div>
        <div>
          <h3 className="font-display font-bold text-[14px] text-[var(--text-1)] tracking-tight">Business Hours</h3>
          <p className="font-body text-[12px] text-[var(--text-3)] mt-0.5">
            Your AI agent references these hours when callers ask about availability.
          </p>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="label-sm block mb-1.5">Timezone</label>
        <select
          value={form.timezone}
          onChange={e => { setForm(prev => ({ ...prev, timezone: e.target.value })); setStatus('idle') }}
          className="input-field"
        >
          {TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz.replace('_', ' ').replace('/', ' / ')}</option>
          ))}
        </select>
      </div>

      {/* Day rows */}
      <div>
        <label className="label-sm block mb-2">Hours per Day</label>
        <div className="border border-[var(--border)] rounded-lg overflow-hidden divide-y divide-[var(--border)]">
          {DAY_KEYS.map(day => {
            const d = form.hours[day]
            return (
              <div key={day} className={`flex items-center gap-3 px-4 py-3 transition-colors ${d.enabled ? 'bg-[var(--surface)]' : 'bg-[var(--surface-2)]'}`}>
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setDay(day, 'enabled', !d.enabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${d.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border-strong)]'}`}
                  title={d.enabled ? 'Click to close this day' : 'Click to open this day'}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${d.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>

                {/* Day label */}
                <span className={`font-display font-bold text-[12px] w-24 flex-shrink-0 ${d.enabled ? 'text-[var(--text-1)]' : 'text-[var(--text-3)]'}`}>
                  {DAY_LABELS[day]}
                </span>

                {d.enabled ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={d.open}
                      onChange={e => setDay(day, 'open', e.target.value)}
                      className="input-field py-1.5 text-[12px] flex-1 min-w-0"
                    />
                    <span className="text-[var(--text-3)] text-[12px] flex-shrink-0">to</span>
                    <input
                      type="time"
                      value={d.close}
                      onChange={e => setDay(day, 'close', e.target.value)}
                      className="input-field py-1.5 text-[12px] flex-1 min-w-0"
                    />
                  </div>
                ) : (
                  <span className="font-body text-[12px] text-[var(--text-3)] flex-1">Closed</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* After-hours message */}
      <div>
        <label className="label-sm block mb-1.5">After-Hours Message</label>
        <textarea
          value={form.after_hours_message}
          onChange={e => { setForm(prev => ({ ...prev, after_hours_message: e.target.value })); setStatus('idle') }}
          rows={3}
          maxLength={500}
          className="input-field resize-none text-[13px] leading-relaxed"
          placeholder="Message your AI agent will convey when called outside business hours…"
        />
        <p className="font-body text-[11px] text-[var(--text-3)] mt-1 text-right">
          {form.after_hours_message.length}/500
        </p>
      </div>

      {/* Save row */}
      <div className="flex items-center justify-between pt-1">
        {status === 'saved' && (
          <div className="flex items-center gap-1.5 text-[var(--live)] text-[12px]">
            <CheckCircle size={13} />
            <span className="font-display font-bold">Saved</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-1.5 text-[var(--danger)] text-[12px]">
            <AlertCircle size={13} />
            <span className="font-body">{errMsg}</span>
          </div>
        )}
        {status === 'idle' && <span />}

        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : 'Save Hours'}
        </button>
      </div>
    </div>
  )
}

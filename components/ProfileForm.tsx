'use client'

import { useState } from 'react'
import { Save, Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase-browser'

interface UserData {
  email: string
  name: string
  avatarUrl: string
}

export default function ProfileForm({ initial }: { initial: UserData }) {
  const [name, setName] = useState(initial.name)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSaved(false)

    const { error } = await supabase.auth.updateUser({
      data: { full_name: name, avatar_url: avatarUrl },
    })

    if (error) {
      setError(error.message)
    } else {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Profile updated',
          message: 'Your display name and avatar have been saved.',
          type: 'success',
        }),
      }).catch(() => {})
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setLoading(false)
  }

  const initials = name
    ? name.slice(0, 2).toUpperCase()
    : initial.email.slice(0, 2).toUpperCase()

  return (
    <div className="card overflow-hidden relative group">
      <div className="absolute inset-0 bg-micro-grid opacity-10 pointer-events-none mix-blend-screen" />
      {/* Avatar banner */}
      <div className="bg-[var(--surface-2)] p-8 border-b border-[var(--border)] relative z-10 overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern opacity-50 mix-blend-screen" />
        <div className="flex items-end gap-5 relative z-10">
          <div className="relative group/avatar">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="w-20 h-20 object-cover border-2 border-[var(--accent)] shadow-[0_0_15px_rgba(255,0,127,0.3)] transition-transform duration-300 group-hover/avatar:scale-105"
              />
            ) : (
              <div className="font-display font-bold flex items-center justify-center w-20 h-20 bg-[var(--accent)] text-[var(--bg)] text-[28px] tracking-tight border-2 border-[var(--accent)] shadow-[0_0_15px_rgba(255,0,127,0.4)] transition-transform duration-300 group-hover/avatar:scale-105">
                {initials}
              </div>
            )}
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center transition-colors duration-300 group-hover/avatar:border-[var(--accent)] group-hover:bg-[var(--accent-tint)] shadow-[0_0_10px_rgba(0,0,0,0.5)]">
              <Camera size={14} className="text-[var(--text-3)] group-hover/avatar:text-[var(--accent)] transition-colors" />
            </div>
          </div>
          <div>
            <p className="font-display font-bold uppercase leading-none text-[18px] tracking-[0.06em] text-[var(--text-1)] drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
              {name || 'Your Name'}
            </p>
            <p className="font-body mt-2 text-[13px] text-[var(--text-3)]">
              {initial.email}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="p-6 flex flex-col gap-6 relative z-10">

        <div>
          <label className="block font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-3">
            Display Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="input-field w-full transition-all focus:shadow-[0_0_10px_rgba(255,0,127,0.2)] focus:border-[var(--accent)]"
          />
        </div>

        <div>
          <label className="block font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-3">
            Email Address
          </label>
          <input
            type="email"
            value={initial.email}
            disabled
            className="input-field w-full opacity-60 cursor-not-allowed"
          />
          <p className="font-body text-[11px] text-[var(--text-3)] mt-2">
            Email cannot be changed here.
          </p>
        </div>

        <div>
          <label className="block font-display font-bold uppercase text-[10px] tracking-[0.2em] text-[var(--text-3)] mb-3">
            Avatar URL
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            className="input-field w-full transition-all focus:shadow-[0_0_10px_rgba(255,0,127,0.2)] focus:border-[var(--accent)]"
          />
          <p className="font-body text-[11px] text-[var(--text-3)] mt-2">
            Paste a public image URL or leave blank to use initials.
          </p>
        </div>

        {error && (
          <div className="font-body text-[12px] text-[var(--danger)] border border-[var(--danger)] p-3 bg-[rgba(255,42,42,0.05)] shadow-[0_0_10px_rgba(255,42,42,0.1)]">
            {error}
          </div>
        )}

        {saved && (
          <div className="font-body text-[12px] text-[var(--live)] border border-[var(--live)] p-3 bg-[rgba(0,255,136,0.05)] shadow-[0_0_10px_rgba(0,255,136,0.1)] animate-[fade-up_0.3s_ease_both]">
            Profile saved successfully.
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? (
              <>
                <span className="inline-block w-1 h-2.5 bg-[var(--bg)] animate-[blink-cursor_0.7s_0s_steps(1)_infinite]" />
                <span className="inline-block w-1 h-2.5 bg-[var(--bg)] animate-[blink-cursor_0.7s_0.2s_steps(1)_infinite]" />
                <span className="inline-block w-1 h-2.5 bg-[var(--bg)] animate-[blink-cursor_0.7s_0.4s_steps(1)_infinite]" />
                Saving
              </>
            ) : (
              <><Save size={14} /> Save Changes</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

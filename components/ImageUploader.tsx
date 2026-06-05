'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, ImageIcon, CheckCircle2, AlertCircle, X } from 'lucide-react'

interface KnowledgeContext {
  id:              string
  source_url:      string
  scraped_at:      string
  structured_data: Record<string, unknown> | null
}

interface Props {
  tenantId:  string
  onSuccess: (ctx: KnowledgeContext) => void
}

const CORNER = ({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) => {
  const styles = {
    tl: 'top-0 left-0 border-t-2 border-l-2 border-[var(--accent)]',
    tr: 'top-0 right-0 border-t-2 border-r-2 border-[var(--accent)]',
    bl: 'bottom-0 left-0 border-b-2 border-l-2 border-[var(--accent)]',
    br: 'bottom-0 right-0 border-b-2 border-r-2 border-[var(--accent)]',
  }
  return (
    <span className={`absolute w-2.5 h-2.5 shadow-[0_0_5px_var(--accent)] ${styles[pos]}`} />
  )
}

export default function ImageUploader({ tenantId, onSuccess }: Props) {
  const [dragging, setDragging] = useState(false)
  const [preview,  setPreview]  = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState(false)
  const fileRef     = useRef<HTMLInputElement>(null)
  const pendingFile = useRef<File | null>(null)

  const accept = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setError('Only PNG, JPEG, or WebP files are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5 MB.')
      return
    }
    setError(null)
    setSuccess(false)
    setFileName(file.name)
    pendingFile.current = file
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) accept(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) accept(file)
  }

  const clear = () => {
    setPreview(null)
    setFileName(null)
    setError(null)
    setSuccess(false)
    pendingFile.current = null
    if (fileRef.current) fileRef.current.value = ''
  }

  const upload = async () => {
    if (!pendingFile.current) return
    setLoading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file',      pendingFile.current)
      form.append('tenant_id', tenantId)
      const res  = await fetch('/api/scrape/multimodal', { method: 'POST', body: form })
      const json = await res.json() as { knowledge_context?: KnowledgeContext; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Vision extraction failed')
      if (!json.knowledge_context) throw new Error('No knowledge context returned from server')
      setSuccess(true)
      onSuccess(json.knowledge_context)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">

      {/* ── Drop zone ─────────────────────────────────────────────────── */}
      {!preview ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`relative flex flex-col items-center justify-center gap-4 py-12 px-6 text-center cursor-pointer transition-all duration-300 group overflow-hidden ${
            dragging 
              ? 'bg-[var(--accent-tint)] border border-[var(--accent)] shadow-[0_0_20px_rgba(255,0,127,0.2)]' 
              : 'bg-[var(--surface)] border border-dashed border-[var(--border-strong)] hover:border-[var(--accent)] hover:bg-[rgba(255,0,127,0.02)]'
          }`}
        >
          <div className="absolute inset-0 bg-dot-pattern opacity-30 pointer-events-none mix-blend-screen" />
          
          {/* Corner markers */}
          <CORNER pos="tl" />
          <CORNER pos="tr" />
          <CORNER pos="bl" />
          <CORNER pos="br" />

          {/* Icon */}
          <div className={`relative z-10 w-12 h-12 flex items-center justify-center border border-[var(--border)] bg-[var(--surface-2)] transition-colors duration-300 ${dragging ? 'shadow-[0_0_15px_rgba(255,0,127,0.3)] border-[var(--accent)]' : 'group-hover:border-[var(--accent)] group-hover:shadow-[0_0_10px_rgba(255,0,127,0.1)]'}`}>
            <ImageIcon size={24} className={dragging ? 'text-[var(--accent)] drop-shadow-[0_0_5px_currentColor]' : 'text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors'} />
          </div>

          {/* Copy */}
          <div className="relative z-10">
            <p className="font-display font-bold uppercase text-[11px] tracking-[0.18em] text-[var(--text-1)] drop-shadow-[0_0_3px_rgba(255,255,255,0.2)]">
              Drop an image here
            </p>
            <p className="font-body mt-1.5 text-[12px] text-[var(--text-3)]">
              PNG, JPEG, or WebP · max 5 MB
            </p>
            <p className="font-body text-[11px] text-[var(--text-3)] opacity-70 mt-1">
              Flyers, price lists, schedule boards, signage
            </p>
          </div>

          <span className="relative z-10 font-display font-bold uppercase text-[10px] tracking-[0.16em] text-[var(--accent)] mt-2 border-b border-[var(--accent)] pb-0.5 glow-text">
            or click to browse
          </span>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </div>
      ) : (
        /* ── Preview + extract ──────────────────────────────────────── */
        <div className="card overflow-hidden">
          <div className="relative border-b border-[var(--border)] bg-micro-grid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="w-full max-h-[260px] object-contain bg-[rgba(18,21,38,0.8)] block backdrop-blur-sm"
            />
            <button
              onClick={clear}
              className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-[rgba(11,13,23,0.8)] border border-[var(--border)] text-[var(--text-2)] cursor-pointer transition-colors hover:bg-[var(--danger)] hover:text-white hover:border-[var(--danger)] hover:shadow-[0_0_10px_rgba(255,42,42,0.4)] backdrop-blur-md"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 p-4 bg-[var(--surface-2)]">
            <div className="flex items-center gap-3 min-w-0">
              <Upload size={14} className="text-[var(--text-3)] shrink-0" />
              <span className="font-body text-[12px] text-[var(--text-2)] truncate">
                {fileName}
              </span>
            </div>
            <button
              onClick={upload}
              disabled={loading || success}
              className={`flex items-center gap-2 px-5 py-2.5 font-display text-[10px] font-bold tracking-[0.14em] uppercase shrink-0 border-none transition-all duration-300 ${
                loading || success 
                  ? 'cursor-not-allowed opacity-75' 
                  : 'cursor-pointer hover:brightness-110 active:translate-y-0.5 active:shadow-none'
              } ${
                success 
                  ? 'bg-[var(--live)] text-[var(--bg)] shadow-[0_0_15px_rgba(0,255,136,0.3)]' 
                  : 'bg-[var(--accent)] text-[var(--bg)] shadow-[0_0_15px_rgba(255,0,127,0.3)]'
              }`}
            >
              {loading ? (
                <>
                  <span className="inline-block w-1 h-2.5 bg-[var(--bg)] animate-[blink-cursor_0.7s_0s_steps(1)_infinite]" />
                  <span className="inline-block w-1 h-2.5 bg-[var(--bg)] animate-[blink-cursor_0.7s_0.2s_steps(1)_infinite]" />
                  <span className="inline-block w-1 h-2.5 bg-[var(--bg)] animate-[blink-cursor_0.7s_0.4s_steps(1)_infinite]" />
                  <span className="ml-1">Analysing</span>
                </>
              ) : success ? (
                <><CheckCircle2 size={14} /> Extracted</>
              ) : (
                <><ImageIcon size={14} /> Extract with Vision AI</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Error / success notices ──────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-3 font-body text-[12px] text-[var(--danger)] border border-[var(--danger)] p-4 bg-[rgba(255,42,42,0.05)] shadow-[0_0_10px_rgba(255,42,42,0.1)]">
          <AlertCircle size={14} className="shrink-0 drop-shadow-[0_0_5px_currentColor]" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 font-body text-[12px] text-[var(--live)] border border-[var(--live)] p-4 bg-[rgba(0,255,136,0.05)] shadow-[0_0_10px_rgba(0,255,136,0.1)] animate-[fade-up_0.3s_ease_both]">
          <CheckCircle2 size={14} className="shrink-0 drop-shadow-[0_0_5px_currentColor]" />
          Vision extraction complete — knowledge context updated.
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Mic, MessageSquare } from 'lucide-react'
import PlaygroundVoice from './PlaygroundVoice'
import PlaygroundChat  from './PlaygroundChat'

export default function PlaygroundTabs() {
  const [tab, setTab] = useState<'voice' | 'chat'>('voice')

  return (
    <div className="flex flex-col w-full max-w-3xl mx-auto gap-4">
      {/* Tab toggle */}
      <div className="flex items-center gap-1 p-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg self-center">
        <button
          onClick={() => setTab('voice')}
          className={`flex items-center gap-2 px-4 py-2 text-[11px] font-display font-bold uppercase tracking-[0.12em] rounded-md transition-all duration-200 ${
            tab === 'voice'
              ? 'bg-[var(--accent)] text-[var(--bg)] shadow-[0_0_12px_var(--accent)]'
              : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
          }`}
        >
          <Mic size={13} />
          Voice
        </button>
        <button
          onClick={() => setTab('chat')}
          className={`flex items-center gap-2 px-4 py-2 text-[11px] font-display font-bold uppercase tracking-[0.12em] rounded-md transition-all duration-200 ${
            tab === 'chat'
              ? 'bg-[var(--accent)] text-[var(--bg)] shadow-[0_0_12px_var(--accent)]'
              : 'text-[var(--text-3)] hover:text-[var(--text-1)]'
          }`}
        >
          <MessageSquare size={13} />
          Chat
        </button>
      </div>

      {/* Panel */}
      {tab === 'voice' ? <PlaygroundVoice /> : <PlaygroundChat />}
    </div>
  )
}

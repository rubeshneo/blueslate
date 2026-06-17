'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

export type LeadCallLog = {
  full_transcript: string | null
  recording_url: string | null
  duration_seconds: number | null
}

export type Lead = {
  id: string
  caller_name: string | null
  caller_phone: string | null
  core_interest: string | null
  call_outcome: string
  booking_slot: string | null
  parsed_at: string
  call_log_id?: string | null
  call_logs?: LeadCallLog | null
}

export function useRealtimeLeads(tenantId: string, initialLeads: Lead[]) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [flash, setFlash] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const supabase = createClient()

  const triggerFlash = useCallback(() => {
    setFlash(true)
    setNewCount((n) => n + 1)
    setTimeout(() => setFlash(false), 4000)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel(`leads:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const incoming = payload.new as Lead
          setLeads((prev) => [incoming, ...prev])
          triggerFlash()
          console.log('[Blueslate Realtime] New lead inserted:', incoming)
        }
      )
      .subscribe((status) => {
        console.log(`[Blueslate Realtime] leads channel status: ${status}`)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, supabase, triggerFlash])

  return { leads, flash, newCount }
}

import { NextRequest, NextResponse } from 'next/server'

const VAPI_API = 'https://api.vapi.ai'

type VapiCallStatus = {
  status?: string
  endedAt?: string
  endedReason?: string
}

export async function GET(req: NextRequest) {
  const callId = req.nextUrl.searchParams.get('callId')
  if (!callId) return NextResponse.json({ error: 'callId required' }, { status: 400 })

  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const res = await fetch(`${VAPI_API}/call/${callId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(8_000),
  })

  if (!res.ok) return NextResponse.json({ error: 'call not found' }, { status: res.status })

  const data = await res.json() as VapiCallStatus
  return NextResponse.json({
    status:      data.status,
    endedAt:     data.endedAt,
    endedReason: data.endedReason,
  })
}

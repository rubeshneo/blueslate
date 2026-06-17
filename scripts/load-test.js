/**
 * Blueslate k6 Load Test
 *
 * Usage:
 *   k6 run scripts/load-test.js \
 *     -e BASE_URL=https://your-app.vercel.app \
 *     -e AUTH_TOKEN=your-supabase-jwt \
 *     -e VAPI_SECRET=your-vapi-webhook-secret
 *
 * Install k6: https://k6.io/docs/get-started/installation/
 * Typical run before demo: k6 run --out json=results.json scripts/load-test.js
 */

import http from 'k6/http'
import { sleep, check, group } from 'k6'
import { Counter, Rate, Trend } from 'k6/metrics'
import { hmac } from 'k6/crypto'

// ── Custom metrics ────────────────────────────────────────────────────────────
const webhookErrors   = new Counter('webhook_errors')
const leadsErrors     = new Counter('leads_errors')
const notifErrors     = new Counter('notification_errors')
const webhookDuration = new Trend('webhook_duration_ms')
const apiErrorRate    = new Rate('api_error_rate')

// ── Test configuration ────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Scenario 1: Steady dashboard traffic (operators polling leads/notifications)
    dashboard_traffic: {
      executor:   'ramping-vus',
      startVUs:   0,
      stages: [
        { duration: '30s', target: 5  },  // ramp up
        { duration: '2m',  target: 10 },  // sustained load
        { duration: '30s', target: 0  },  // ramp down
      ],
      exec: 'dashboardScenario',
    },
    // Scenario 2: Webhook burst (Vapi firing end-of-call-reports)
    webhook_burst: {
      executor:   'constant-arrival-rate',
      rate:       3,           // 3 webhooks/second
      timeUnit:   '1s',
      duration:   '1m',
      preAllocatedVUs: 10,
      exec: 'webhookScenario',
    },
  },
  thresholds: {
    // 95th-percentile response under 500 ms for all requests
    http_req_duration:   ['p(95)<500'],
    // Less than 1% error rate
    http_req_failed:     ['rate<0.01'],
    api_error_rate:      ['rate<0.01'],
    // Webhook specifically must be fast — it's in the hot path
    webhook_duration_ms: ['p(95)<300'],
  },
}

const BASE_URL    = __ENV.BASE_URL    || 'http://localhost:3000'
const AUTH_TOKEN  = __ENV.AUTH_TOKEN  || ''
const VAPI_SECRET = __ENV.VAPI_SECRET || 'dev-secret'

const AUTH_HEADERS = {
  'Content-Type':  'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
}

// ── Scenario A: Dashboard traffic ─────────────────────────────────────────────
export function dashboardScenario() {
  group('leads list', () => {
    const res = http.get(`${BASE_URL}/api/leads`, { headers: AUTH_HEADERS })
    const ok  = check(res, {
      'leads 200': r => r.status === 200,
      'leads has data key': r => {
        try { return 'leads' in JSON.parse(r.body) } catch { return false }
      },
    })
    if (!ok) leadsErrors.add(1)
    apiErrorRate.add(res.status >= 400 ? 1 : 0)
  })

  sleep(2)

  group('notifications poll', () => {
    const res = http.get(`${BASE_URL}/api/notifications`, { headers: AUTH_HEADERS })
    const ok  = check(res, {
      'notifications 200': r => r.status === 200,
    })
    if (!ok) notifErrors.add(1)
    apiErrorRate.add(res.status >= 400 ? 1 : 0)
  })

  sleep(3)

  group('tenant identity', () => {
    const res = http.get(`${BASE_URL}/api/tenant-identity`, { headers: AUTH_HEADERS })
    check(res, { 'tenant-identity 200': r => r.status === 200 })
    apiErrorRate.add(res.status >= 400 ? 1 : 0)
  })

  sleep(5)
}

// ── Scenario B: Vapi webhook bursts ──────────────────────────────────────────
export function webhookScenario() {
  const callId   = `k6-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const endedAt  = new Date().toISOString()
  const startedAt = new Date(Date.now() - 90_000).toISOString()

  const payload = JSON.stringify({
    message: {
      type:         'end-of-call-report',
      transcript:   `AI: Thanks for calling! How can I help you today?
User: Hi I'm interested in your programs for my 8 year old.
AI: Great! We have programs for kids aged 6 to 12. Could I get your name and number?
User: Sure, I'm Sarah Johnson, 555-867-5309.
AI: Perfect Sarah, I've noted your details. Someone will follow up shortly!`,
      recordingUrl: null,
      call: {
        id:           callId,
        startedAt,
        endedAt,
        assistantId:  __ENV.ASSISTANT_ID || 'test-assistant-id',
        customer:     { number: '+15558675309' },
        metadata:     { tenant_id: __ENV.TENANT_ID || '' },
      },
    },
  })

  // Sign the payload with HMAC-SHA256 (matches verifyVapiSignature in the route)
  const signature = hmac('sha256', VAPI_SECRET, payload, 'hex')

  const start = Date.now()
  const res   = http.post(`${BASE_URL}/api/webhooks/vapi`, payload, {
    headers: {
      'Content-Type':     'application/json',
      'x-vapi-signature': signature,
    },
  })
  webhookDuration.add(Date.now() - start)

  const ok = check(res, {
    'webhook 200': r => r.status === 200,
    'webhook success': r => {
      try { return JSON.parse(r.body).success === true } catch { return false }
    },
  })
  if (!ok) {
    webhookErrors.add(1)
    apiErrorRate.add(1)
  } else {
    apiErrorRate.add(0)
  }
}

// ── Default scenario (run when no scenario specified) ─────────────────────────
export default function () {
  dashboardScenario()
}

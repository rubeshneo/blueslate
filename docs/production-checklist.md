# Blueslate — Pre-Demo Production Checklist

Run this end-to-end the night before demo day. Check every box before going live.

---

## 1. Environment & Secrets

- [ ] `NEXT_PUBLIC_SUPABASE_URL` set in Vercel environment variables
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set (server-only, never exposed to client)
- [ ] `GROQ_API_KEY` valid and has remaining quota (check console.groq.com)
- [ ] `VAPI_API_KEY` set and Vapi account has credit balance
- [ ] `VAPI_ASSISTANT_ID` points to the live demo assistant
- [ ] `VAPI_WEBHOOK_SECRET` set — without this, HMAC check allows all requests in prod
- [ ] `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` set
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set
- [ ] `ADMIN_EMAIL` set (gates `/api/reset` and `/api/clean-db`)
- [ ] `NEXT_PUBLIC_APP_URL` set to production domain (drives CSP + CORS)
- [ ] `TENANT_ID` set as fallback for single-tenant dev deploys

---

## 2. Supabase

- [ ] RLS is ON for all tables: `tenants`, `leads`, `call_logs`, `knowledge_context`, `notifications`
- [ ] All migrations run in order (001 → 002 → 003 → 004 → 005)
- [ ] Realtime enabled on the `leads` table (for live dashboard push)
- [ ] Realtime enabled on the `notifications` table
- [ ] Demo tenant record exists and has `vapi_agent_id` + `vapi_phone_number` populated
- [ ] Demo user exists and `app_metadata.tenant_id` points to the demo tenant
- [ ] No stale test leads that would pollute the demo dashboard (run `/api/reset` if needed)

---

## 3. Vapi

- [ ] Demo assistant responds correctly on a test call
- [ ] End-of-call webhook fires to `{APP_URL}/api/webhooks/vapi` (check Vapi dashboard → Logs)
- [ ] Webhook receives and stores leads (make a test call, check Supabase `leads` table)
- [ ] Business hours are configured and reflected in the agent's system prompt
- [ ] After-hours message is set

---

## 4. Twilio

- [ ] Trial account upgraded OR "To" number is verified if on trial
- [ ] Test SMS: `POST /api/vapi/outbound` triggers a call AND nurture SMS fires after
- [ ] Twilio number is linked to Vapi assistant (or Vapi-bought number is used)

---

## 5. Core Flows — Smoke Test

Run each of these manually before demo day:

- [ ] **Loop A (Knowledge):** Open `/` → Knowledge tab → paste franchise URL → Scan Site → knowledge appears + "Synced ✓" shown
- [ ] **Loop B (Inbound call):** Call the Vapi phone number → agent answers with correct greeting → lead appears in dashboard within 60s
- [ ] **Loop C (Lead capture):** After the call above, check `leads` table — caller name + interest + outcome parsed correctly
- [ ] **Outbound callback:** Select a lead in the dashboard → Call Back → Vapi places the outbound call
- [ ] **Batch Call All:** Select multiple leads → "Call All" → progress counter increments → calls placed
- [ ] **Analytics:** Switch between 7d / 30d / All — charts update; KPI row reflects filtered range
- [ ] **CSV export:** Click Export CSV on leads page → file downloads with correct columns
- [ ] **Notifications:** After a call, notification bell shows the new lead within 30s
- [ ] **Onboarding wizard:** Create a fresh test account → complete all 5 steps → dashboard accessible
- [ ] **Admin panel:** `/admin` loads all tenants; suspend/reinstate works without error

---

## 6. Security Headers

Verify in browser DevTools (Network tab → any response → Headers):

- [ ] `X-Frame-Options: DENY` present
- [ ] `X-Content-Type-Options: nosniff` present
- [ ] `Content-Security-Policy` header present
- [ ] `Referrer-Policy: strict-origin-when-cross-origin` present
- [ ] `Access-Control-Allow-Origin` restricted to app domain on `/api/*` responses

---

## 7. Performance

- [ ] Run k6 load test: `k6 run scripts/load-test.js -e BASE_URL=https://your-app.vercel.app -e AUTH_TOKEN=...`
- [ ] p95 latency < 500 ms for dashboard endpoints
- [ ] Webhook p95 < 300 ms
- [ ] No errors under 10 concurrent users
- [ ] Vercel Function logs show no cold-start failures (first hit may be slow — warm it up)

---

## 8. Demo Environment

- [ ] Demo laptop charged + charger available
- [ ] Backup hotspot ready (do not rely on venue WiFi)
- [ ] Browser tab order pre-set: Landing → Dashboard → Leads → Analytics → Settings → Admin
- [ ] Test phone number ready for a live inbound call demo
- [ ] Screen sharing tested — demo at 1080p, browser zoom at 90%
- [ ] Vapi account credit confirmed > $5 remaining
- [ ] Groq rate limit reset (free tier: ~14,400 req/day — confirm you haven't burned it)
- [ ] Supabase free-tier pause is OFF (databases auto-pause after 7 days of inactivity)

---

## 9. Day-of Sequence

1. Open app in a fresh incognito window — verify landing page loads
2. Log in with the demo account — verify dashboard loads with existing leads
3. Make one test inbound call to confirm Vapi → webhook → lead flow is live
4. Refresh dashboard — new lead visible, notification bell has unread count
5. You're ready.

# Blueslate — Demo Day Script

**Audience:** Franchise operators / investors / NeoAistriq stakeholders  
**Slot:** 10 minutes live demo + 5 minutes Q&A  
**One-liner:** "An AI receptionist that answers your franchise's calls, captures leads, and lets you call them back — all before you finish your coffee."

---

## Opening Hook (30 seconds)

> "XP League Frisco misses roughly 40% of inbound calls. Every missed call is a $1,200 registration fee walking out the door. Today I'm going to show you how a franchise owner named Rubesh solved that in 21 days — for zero dollars."

**Why it works:** Opens with a dollar figure, not a feature list.

---

## Act 1 — The Landing Page (1 minute)

**What to show:** `https://your-app.vercel.app/landing`

Talking points:
- "This is what a new franchise owner sees. They sign up, pick a plan — we offer a $0 Starter tier — and they're in the wizard in under 60 seconds."
- Hit "Get Started Free" → show the onboarding wizard briefly
- "Five steps. Business name, website, agent name, knowledge scan, phone provisioning. Done."

**Don't linger here** — the magic is in the live call.

---

## Act 2 — The Live Call (3 minutes) ★ Centerpiece

**Setup:** Have a phone ready. The Vapi number should be printed on a card in front of you.

**What to show:** Dashboard at `/`

> "Watch the lead registry. It's empty right now. I'm going to call the AI receptionist."

**Make the call live.** Talk naturally:
- "Hi, I'm interested in signing my daughter up for a program."
- Give a name and phone number when asked.
- Hang up.

> "Vapi's webhook fires, Groq parses the transcript in about 2 seconds, and..."

**Watch the dashboard update in real time** — the lead flashes in via Supabase Realtime. The notification bell badge increments.

> "Name extracted, interest extracted, outcome classified. No human touched this."

**If the live call fails:** Have a screenshot or recording pre-loaded. The transcript and lead record are the story, not the call itself.

---

## Act 3 — Lead Intelligence (2 minutes)

**What to show:** Click the new lead row → Transcript Drawer

Talking points:
- "Full transcript. Outcome auto-classified as 'interested'. Booking slot detected if they mentioned one."
- Change the outcome dropdown: "Operators can override."
- Hit Call Back: "One click — Vapi calls them back from the franchise's dedicated number."
- Show the batch selection: "Or select all callbacks-requested leads and hit Call All. Sequential dialing, 800ms between calls, live progress."

---

## Act 4 — Analytics & Knowledge (2 minutes)

**What to show:** Analytics tab, then Knowledge tab

Analytics:
- Toggle 7d / 30d / All — charts update instantly
- "Booking rate, average call duration, interest distribution — all automatic."

Knowledge:
- Show the structured data extracted from the franchise URL
- Edit a field inline: "Operators can correct the AI's knowledge without touching code."
- "Synced ✓ — Vapi picks up the change on the next call."

---

## Act 5 — The Close (1 minute)

> "21 days. Zero dollars in infrastructure. Three loops:"

Draw on screen or gesture:
1. **Loop A** — Website → AI Knowledge → Vapi system prompt
2. **Loop B** — Phone call → AI dialogue → Lead captured
3. **Loop C** — Lead → Groq parse → Dashboard + SMS nurture

> "This is running on Vercel Hobby, Supabase free tier, Groq free tier, and Vapi's $10 trial credit. The unit economics work before the first paying customer."

---

## Q&A Prep

| Question | Answer |
|----------|--------|
| "What if the AI says something wrong?" | Knowledge is editable inline and syncs to Vapi in seconds. Operators stay in control. |
| "Can it handle multiple franchise locations?" | Multi-tenant architecture — each franchise operator gets an isolated workspace, their own Vapi assistant, and their own phone number. |
| "What does it cost at scale?" | $0 during validation. At 1,000 calls/month: Vapi ~$20, Groq ~$5, Supabase ~$25. Under $50/month per location. |
| "Is the data secure?" | Row-Level Security on every table — operators can only see their own leads. HMAC-signed webhooks, CSP headers, CORS locked to the app domain. |
| "How long to onboard a new franchise?" | 5-step wizard takes about 3 minutes. Phone provisioning is the longest step — Vapi buys the number automatically. |
| "What's the hardest technical part?" | Mapping inbound calls to the right tenant without a login session. Solved it with Vapi assistant ID → tenant lookup + env fallback chain. |

---

## Timing Guide

| Segment | Time | Cumulative |
|---------|------|------------|
| Opening hook | 0:30 | 0:30 |
| Landing + wizard | 1:00 | 1:30 |
| Live call setup | 0:30 | 2:00 |
| Live call + dashboard update | 2:00 | 4:00 |
| Lead drawer + callback | 1:30 | 5:30 |
| Batch Call All | 0:30 | 6:00 |
| Analytics toggle | 1:00 | 7:00 |
| Knowledge edit | 0:45 | 7:45 |
| Closing 3-loop summary | 1:00 | 8:45 |
| Buffer | 1:15 | 10:00 |

---

## Contingency Plan

| Risk | Mitigation |
|------|-----------|
| Vapi call drops | Pre-record a 90s call video; play it and narrate live |
| Webhook doesn't fire | Show a pre-existing lead in the dashboard; walk through transcript |
| Supabase is paused | Warm up the app 30 minutes before — free tier pauses after inactivity |
| Slow cold start | Open the app 10 minutes before; Vercel serverless warms on first request |
| No WiFi | Hotspot on phone; Vapi calls over cellular anyway |

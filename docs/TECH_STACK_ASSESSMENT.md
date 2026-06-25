# Blueslate — Tech Stack Assessment & Production-Readiness Report

**Prepared for:** Project Lead / Leadership
**Subject:** Why the current free-tier stack delivers a *complete, working prototype* — and what reaching a "100% production-grade" product actually requires.
**Status:** Prototype (pilot-ready) · Not yet production-grade
**Last updated:** 2026-06-24

> ⚠️ Free-tier limits and pricing referenced below change frequently. Treat the numbers as accurate at time of writing and re-verify against each provider's current pricing page before budgeting.

---

## 1. Executive Summary (read this first)

We were asked to build a **polished, complete web app** on a **$0 / free-tier budget**. Here is the honest position:

- **What we delivered:** a fully functional, end-to-end product — AI voice receptionist, automatic knowledge ingestion from a website/social profile, live AI chat demo, lead capture + dashboards, SMS nurture, multi-step onboarding, and an admin panel. It works today and is demo-ready.
- **What "100%" means and why free tiers can't guarantee it:** a "100% production-grade" SaaS implies **guaranteed uptime (SLA), scale, data durability/backups, security & compliance, and predictable cost.** Free tiers are explicitly **not designed for that** — they are built for prototyping and learning. Several of our "free" services also **cost real money the moment real customers use them** (voice minutes, phone numbers, SMS).

**The reframe for leadership:** This is not a failure to deliver — it is the *correct* engineering decision for a validation phase. We have proven the concept with a real, working product at zero cost. Reaching "100%" is a **known, budgetable next step**: move ~5 components from free to paid tiers and add production hardening (backups, monitoring, security). This document lists exactly which, why, and the rough cost.

---

## 2. What "100% polished & complete" actually requires

A demo that looks finished is not the same as a production product. "100%" implies all of the below — and free tiers gate most of them:

| Production dimension | What it means | Free-tier reality |
| :--- | :--- | :--- |
| **Reliability / SLA** | Guaranteed uptime, no surprise pauses | ❌ No SLA on any free tier; some services auto-pause |
| **Scale** | Handles many tenants & concurrent traffic | ⚠️ Hard rate limits & quotas |
| **Data durability** | Automated backups, point-in-time recovery | ❌ Not included on free tiers |
| **Security & compliance** | RLS, audit, GDPR / India DPDP | ⚠️ Partially implemented |
| **Cost predictability** | Known cost per customer | ⚠️ Usage-based services (voice/SMS) are unpredictable |
| **Support** | Vendor support when something breaks | ❌ Community-only on free tiers |
| **Commercial licensing** | TOS permits commercial use | ❌ Some free tiers are non-commercial only |

---

## 3. Current stack overview

| Layer | Technology | Tier used | Role |
| :--- | :--- | :--- | :--- |
| Framework | **Next.js 14 + React 18 + TypeScript + Tailwind** | OSS | Web app (frontend + API routes) |
| Hosting | **Vercel** | Hobby (free) | Deployment + serverless functions |
| Database / Auth / Realtime | **Supabase** | Free | Postgres, authentication, realtime leads |
| LLM (our side) | **Groq** (Llama 3.1 / 3.3) | Free | AI receptionist Q&A, lead/transcript extraction |
| LLM (alternative) | **Google Gemini** | Free API | Parallel individual build — pros & cons in §6 |
| Voice AI | **Vapi.ai** | ~$10 trial credit | Phone-based voice receptionist |
| SMS | **Twilio** | Trial | Lead nurture text messages |
| Web scraping | **Jina.ai Reader + Cheerio** | Free (no key) | Ingest franchise website/social knowledge |
| Cache / Notifications | **Upstash Redis** | Free | In-app notifications |

---

## 4. Why the free stack was the right call (the pros)

- **$0 cost** to build and validate a real product.
- **Speed:** modern managed services let one small team ship an end-to-end app fast.
- **Real, working features** — not mockups: live voice calls, real AI answers, real lead capture.
- **Easy to demo** and put in front of pilot customers immediately.
- **Low switching cost:** the paid tiers of these *same* services are the production path — no rewrite needed, just upgrades.

This is exactly what a prototype/MVP phase is for.

---

## 5. Component-by-component: pros, cons & the hard limits

### 5.1 Vercel (Hobby) — Hosting
- **Pros:** instant deploys, global CDN, zero config, generous for demos.
- **Cons / limits:** **Hobby is for non-commercial use per Vercel's TOS** — a commercial product needs **Pro (~$20/user/mo)**. Serverless function timeout is short (~10s on Hobby), which constrains long AI/voice operations. No SLA; cold starts add latency.
- **Blocks "100%":** ✅ Yes — commercial use + reliability.

### 5.2 Supabase (Free) — DB / Auth / Realtime
- **Pros:** Postgres + Auth + Realtime + storage in one; great DX.
- **Cons / limits:** **Project auto-pauses after ~7 days of inactivity** (cold start on next hit); ~**500 MB** database; **no automated backups / point-in-time recovery** on free; shared CPU; egress caps. Our tenant isolation (Row-Level Security) is **not yet fully enforced**.
- **Blocks "100%":** ✅ Yes — durability, isolation, no pausing.

### 5.3 Groq (Free) — our LLM
- **Pros:** extremely fast inference; generous free limits; great for real-time chat/voice.
- **Cons / limits:** **strict rate limits** (requests & tokens per minute/day); **no uptime SLA**; models can be deprecated or changed without notice; free-tier data-handling terms differ from enterprise.
- **Blocks "100%":** ✅ Yes — rate limits + no SLA at scale.

### 5.4 Vapi.ai (~$10 credit) — Voice
- **Pros:** turnkey phone voice agents; handles telephony + speech.
- **Cons / limits:** **not free** — voice is **~$0.05–0.15/min**, phone numbers **~$2–5/number/month**, plus telephony fees. The $10 credit is a **trial that runs out quickly** under real usage. Open self-serve signup could let users **spend your credit** by provisioning numbers.
- **Blocks "100%":** ✅ Yes — this is a real, ongoing per-use cost, not free.

### 5.5 Twilio (Trial) — SMS
- **Pros:** reliable, industry-standard; already integrated (mock-safe fallback).
- **Cons / limits:** **trial can only text pre-verified numbers**, adds a *"Sent from your Twilio trial account"* watermark, and uses trial credit. Real use requires a **paid upgrade** + a purchased number (~$1/mo + per-message fees).
- **Blocks "100%":** ✅ Yes — trial cannot message real customers.

### 5.6 Jina.ai Reader + Cheerio (Free) — Scraping
- **Pros:** no API key, handles JS-rendered & bot-protected pages, clean markdown output.
- **Cons / limits:** public free endpoint with **rate limits and no SLA**; best-effort availability; may fail on some sites; not contractually reliable for production.
- **Blocks "100%":** ⚠️ Partial — fine for now, needs a paid/again-fallback plan for reliability.

### 5.7 Upstash Redis (Free) — Notifications
- **Pros:** serverless Redis, simple, generous for light use.
- **Cons / limits:** **~10,000 commands/day**, **256 MB** — fine at pilot scale, caps at growth.
- **Blocks "100%":** ⚠️ Low risk near-term.

---

## 6. The LLM tools — pros & cons

Both run on free tiers and are assessed here on their own terms.

### Google Gemini — Flash / Pro (free API)
Google's frontier multimodal model family, accessed through the free Google AI Studio API.

- **Pros:**
  - **Frontier-quality reasoning** — strong on complex, nuanced tasks.
  - **Native multimodal** — text, images, audio & video in one model.
  - **Very large context** (up to ~1M tokens) for big documents.
  - **Generous free tier** backed by Google infrastructure.
- **Cons:**
  - **Privacy:** the free tier may use submitted data to improve Google's products (the paid tier does not) — a concern for customer data.
  - **Higher latency** — less suited to ultra-real-time voice.
  - **Free rate limits** and **no SLA**.
  - Some **regional availability** restrictions.

### Groq — Llama 3.1 / 3.3 (free trial)
Hosts open models on custom LPU hardware, with an OpenAI-compatible API.

- **Pros:**
  - **Blazing-fast inference** (LPU) — lowest latency, ideal for real-time voice & chat.
  - **Generous free dev limits** to build and test at $0.
  - **OpenAI-compatible API** — simple to integrate and swap models.
  - **Open models** (Llama, etc.) — no lock-in to a closed model.
- **Cons:**
  - **Strict rate limits** on free (requests & tokens per minute/day).
  - **No SLA**; hosted models can be deprecated or changed.
  - **Text-focused** — limited multimodal capability.
  - Open models can **trail frontier models** on the hardest reasoning.

---

## 7. The honest gap — what we *cannot* guarantee at 100% on free tiers

Consolidated list of why "100% production-grade" is not deliverable on the current stack:

1. **No SLA / uptime guarantee** on any free service.
2. **Supabase pauses** after inactivity → the app can appear "down."
3. **Usage-based costs are real** — Vapi voice minutes, phone numbers, and Twilio SMS are *not* free at any real volume.
4. **Vercel Hobby is non-commercial** per its TOS.
5. **No automated backups / disaster recovery.**
6. **Rate limits** on Groq / Gemini / Jina cap concurrent usage.
7. **Security hardening incomplete** — tenant isolation (RLS), audit logging, compliance (GDPR / India DPDP) not finished.
8. **No monitoring / alerting / observability.**
9. **No spend caps** — runaway Vapi/SMS usage isn't bounded.
10. **Community-only support** — no vendor escalation if something breaks.

---

## 8. What it takes to reach production-grade

The good news: **no rewrite** — it's mostly tier upgrades + hardening on the *same* services.

| Component | Free today | Production move | Rough cost (verify current) |
| :--- | :--- | :--- | :--- |
| Vercel | Hobby | **Pro** (commercial + better limits) | ~$20 / user / mo |
| Supabase | Free | **Pro** (backups, no pausing, more compute) | ~$25 / mo + usage |
| Groq / LLM | Free | Paid tier (budget for traffic) | usage-based |
| Vapi | $10 credit | Pay-as-you-go top-up | ~$0.05–0.15 / min + numbers |
| Twilio | Trial | Upgrade + buy number(s) | ~$1 / number / mo + per-msg |
| Jina | Free | Paid Reader plan or self-host fallback | low |
| Upstash | Free | Pay-as-you-go | low until scale |
| **Hardening** | — | RLS, backups, monitoring, compliance | engineering time |

**Indicative baseline (small pilot, excluding voice/SMS usage): ~$65–100/month** in fixed costs, plus variable voice/SMS usage. Voice and SMS scale with call volume and must be modeled per customer.

---

## 9. Recommendation & verdict

- **Verdict:** A **100% production-grade product is not achievable on a pure free-tier stack** — primarily because of (a) no SLA/backups, (b) genuinely usage-priced voice/SMS, and (c) non-commercial licensing on parts of the stack. This is a property of free tiers, not of the team's work.
- **What we have is valuable:** a complete, working prototype that proves the concept and is ready for a controlled pilot.
- **Recommended next steps to close the gap:**
  1. **Pick the target:** keep as a **free pilot** (invite-only, low usage) *or* commit to **production** (budget the upgrades above).
  2. **Plan for LLM scale:** free Groq/Gemini rate limits won't hold under real traffic — budget a paid LLM tier (and mind Gemini's free-tier data terms for customer data).
  3. **Upgrade the two blockers first:** Vercel Pro (licensing) + Supabase Pro (backups/no-pausing).
  4. **Add production hardening:** enforce RLS, automated backups, monitoring, and a usage/cost guard on Vapi.
  5. **Model voice/SMS cost per customer** so pricing covers it.

**Bottom line for leadership:** We delivered a complete, working product at **$0** to validate the idea. "100%" is a funding-and-hardening decision, not a missing-features decision — and we can reach it on the *same* stack by upgrading specific components and finishing security/backup work.

---

*This document reflects the stack in this repository as of the date above. Verify all third-party limits and pricing against current vendor documentation before financial decisions.*

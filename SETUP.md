# Blueslate — Setup Guide (Week 1)

## 1. Supabase Setup (5 min)

1. Create a free project at https://supabase.com
2. Go to **SQL Editor** → paste & run `supabase/migrations/001_initial_schema.sql`
3. Copy from **Project Settings → API**:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Anthropic API Key (2 min)

1. Go to https://console.anthropic.com/settings/keys
2. Create a new key → `ANTHROPIC_API_KEY`
   - Uses `claude-haiku-4-5` (cheapest, fastest) — trial credits cover Week 1–2

## 3. Vapi.ai Setup (10 min)

1. Sign up at https://vapi.ai (free $10 credit)
2. Create an **Assistant** with the system prompt below
3. Under **Phone Numbers** → buy/import your Twilio number
4. Set the **Server URL** (webhook) to: `https://your-app.vercel.app/api/webhooks/vapi`
5. In assistant **Metadata**, add: `{ "tenant_id": "<your-xp-league-frisco-uuid>" }`
6. Copy your API key → `VAPI_API_KEY`

### Vapi System Prompt for XP League Frisco
```
You are the AI receptionist for XP League Frisco, a youth esports franchise.
Be warm, professional, and concise.

Your goals:
1. Greet the caller and ask how you can help
2. Answer questions about programs, age groups, pricing, and schedules
3. Qualify the caller's interest (which child, age, game preference)
4. Offer to book a FREE intro session — ask for their preferred day/time
5. Capture their name and contact info

Always end with: "Is there anything else I can help you with before I let you go?"
```

## 4. Twilio Trial Account (5 min)

1. Sign up at https://www.twilio.com (free $15.50 trial credit)
2. Get a trial phone number
3. Link it to your Vapi account (Vapi → Phone Numbers → Import from Twilio)
4. Update the `tenants` table: `UPDATE tenants SET phone_number = '+1XXXXXXXXXX' WHERE slug = 'xp-league-frisco';`

## 5. Local Development

```bash
cp .env.local.example .env.local
# Fill in all values in .env.local

npm install
npm run dev
# Open http://localhost:3000
```

## 6. Vercel Deployment

```bash
npm install -g vercel
vercel --prod
# Add environment variables in Vercel Dashboard → Settings → Environment Variables
```

## Week 1 Milestone Checklist

- [ ] Supabase schema deployed with RLS policies
- [ ] `xp-league-frisco` tenant seeded
- [ ] App builds and runs locally
- [ ] `/knowledge` page: scrape xpleague.com/frisco → Claude extracts structured data
- [ ] Deployed to Vercel (free Hobby plan)
- [ ] Webhook URL configured in Vapi

## File Structure

```
blueslate/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── knowledge/page.tsx    # Loop A: Scrape + knowledge editor
│   ├── calls/page.tsx        # Loop B: Call logs
│   ├── leads/page.tsx        # Loop C: Auto-parsed leads
│   └── api/
│       ├── scrape/           # POST: scrape URL → Claude extract → DB
│       ├── knowledge-context/ # GET + PATCH
│       ├── call-logs/        # GET
│       ├── leads/            # GET
│       ├── tenants/          # GET
│       └── webhooks/vapi/    # POST: Vapi end-of-call → parse transcript → leads
├── components/               # Sidebar, StatCard, tables, TenantSelector
├── lib/
│   ├── supabase.ts           # Client + admin + types
│   ├── claude.ts             # extractKnowledge + parseTranscript
│   └── scraper.ts            # Cheerio URL scraper
└── supabase/migrations/      # 001_initial_schema.sql
```

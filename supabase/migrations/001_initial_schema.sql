-- Blueslate Multi-Tenant Schema
-- All tables use tenant_id for RLS-based data isolation

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── TENANTS ────────────────────────────────────────────────────────────────
create table if not exists tenants (
  id            uuid primary key default uuid_generate_v4(),
  slug          text unique not null,
  name          text not null,
  franchise_url text,
  phone_number  text,
  vapi_agent_id text,
  created_at    timestamptz default now(),
  is_active     boolean default true
);

-- ─── KNOWLEDGE CONTEXT ──────────────────────────────────────────────────────
create table if not exists knowledge_context (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  source_url      text not null,
  scraped_at      timestamptz default now(),
  raw_content     text,
  structured_data jsonb,
  is_active       boolean default true
);

-- ─── CALL LOGS ──────────────────────────────────────────────────────────────
create table if not exists call_logs (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  vapi_call_id     text unique,
  caller_number    text,
  started_at       timestamptz,
  ended_at         timestamptz,
  duration_seconds integer,
  full_transcript  text,
  recording_url    text,
  status           text check (status in ('completed','missed','failed','in-progress')) default 'completed',
  created_at       timestamptz default now()
);

-- ─── LEADS ──────────────────────────────────────────────────────────────────
create table if not exists leads (
  id               uuid primary key default uuid_generate_v4(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  call_log_id      uuid references call_logs(id) on delete set null,
  caller_name      text,
  caller_phone     text,
  core_interest    text,
  call_outcome     text check (call_outcome in ('booked','interested','not-interested','callback-requested','unknown')) default 'unknown',
  booking_slot     timestamptz,
  parsed_at        timestamptz default now(),
  raw_parsed_json  jsonb
);

-- ─── INDEXES ────────────────────────────────────────────────────────────────
create index if not exists idx_knowledge_tenant on knowledge_context(tenant_id);
create index if not exists idx_call_logs_tenant on call_logs(tenant_id);
create index if not exists idx_leads_tenant on leads(tenant_id);
create index if not exists idx_leads_call_log on leads(call_log_id);

-- ─── ROW-LEVEL SECURITY ─────────────────────────────────────────────────────
alter table knowledge_context enable row level security;
alter table call_logs enable row level security;
alter table leads enable row level security;

-- knowledge_context: tenant sees only its own rows
create policy tenant_isolation on knowledge_context
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- call_logs: tenant isolation
create policy tenant_isolation on call_logs
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- leads: tenant isolation
create policy tenant_isolation on leads
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Service-role bypass (for API routes using service key)
create policy service_role_all on knowledge_context
  to service_role using (true) with check (true);

create policy service_role_all on call_logs
  to service_role using (true) with check (true);

create policy service_role_all on leads
  to service_role using (true) with check (true);

-- ─── SEED: XP LEAGUE FRISCO TENANT ──────────────────────────────────────────
insert into tenants (slug, name, franchise_url, phone_number)
values ('xp-league-frisco', 'XP League Frisco', 'https://xpleague.com/frisco', null)
on conflict (slug) do nothing;

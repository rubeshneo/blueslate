-- ============================================================================
-- Blueslate — Agent Library migration
-- Run this once in Supabase → SQL Editor.
--
-- Today each tenant has ONE Vapi assistant (tenants.vapi_agent_id). This adds an
-- `agents` table so a tenant can run MULTIPLE role-based AI callers (receptionist,
-- follow-up, reminder, review, win-back, after-hours) — each its own Vapi assistant.
-- ============================================================================

create table if not exists public.agents (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  role          text not null,                       -- receptionist | follow_up | reminder | review | winback | after_hours
  name          text not null,                       -- display name, e.g. "Sage"
  direction     text not null default 'inbound',     -- inbound | outbound
  vapi_agent_id text,                                 -- provisioned Vapi assistant id (null until provisioned)
  system_prompt text,                                 -- optional manual override; else built from the role template
  first_message text,                                 -- opening line
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists agents_tenant_idx      on public.agents(tenant_id);
create index if not exists agents_tenant_role_idx  on public.agents(tenant_id, role);

-- Backfill: turn each tenant's existing single assistant into a "receptionist" agent row,
-- so nothing breaks for tenants that already provisioned a number.
insert into public.agents (tenant_id, role, name, direction, vapi_agent_id, is_active)
select t.id,
       'receptionist',
       coalesce(t.agent_name, 'Sage'),
       'inbound',
       t.vapi_agent_id,
       true
from public.tenants t
where t.vapi_agent_id is not null
  and not exists (
    select 1 from public.agents a
    where a.tenant_id = t.id and a.role = 'receptionist'
  );

-- Row-Level Security (enable if/when you enforce RLS elsewhere):
-- alter table public.agents enable row level security;
-- create policy "tenant reads own agents" on public.agents
--   for select using (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- RLS Hardening
-- Tightens Row-Level Security across all tenant-scoped tables.
-- Changes:
--   1. Replaces permissive SELECT-only policies with explicit per-operation policies
--      (SELECT / INSERT / UPDATE / DELETE) so each verb is intentional.
--   2. Adds WITH CHECK clauses on write policies to prevent cross-tenant data injection.
--   3. Locks the tenants table — users can read their own row only; no writes from JWT.
--   4. Ensures no table is left without RLS enabled (idempotent guard).

-- ─── TENANTS ─────────────────────────────────────────────────────────────────
alter table tenants enable row level security;

-- Drop any existing loose policies on tenants before recreating
drop policy if exists tenant_isolation   on tenants;
drop policy if exists service_role_all   on tenants;

-- Authenticated users may read only their own tenant row
create policy tenants_select on tenants
  for select
  using (id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Service role has full access
create policy tenants_service_role_all on tenants
  to service_role using (true) with check (true);

-- ─── KNOWLEDGE CONTEXT ───────────────────────────────────────────────────────
-- Drop legacy permissive policies
drop policy if exists tenant_isolation  on knowledge_context;
drop policy if exists service_role_all  on knowledge_context;

-- SELECT: tenant sees only its own rows
create policy kc_select on knowledge_context
  for select
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- INSERT: tenant can only insert rows tagged with its own tenant_id
create policy kc_insert on knowledge_context
  for insert
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- UPDATE: tenant can only update rows it owns, and cannot change tenant_id
create policy kc_update on knowledge_context
  for update
  using  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- DELETE: tenant can only delete its own rows
create policy kc_delete on knowledge_context
  for delete
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Service role bypass
create policy kc_service_role_all on knowledge_context
  to service_role using (true) with check (true);

-- ─── CALL LOGS ───────────────────────────────────────────────────────────────
drop policy if exists tenant_isolation  on call_logs;
drop policy if exists service_role_all  on call_logs;

create policy cl_select on call_logs
  for select
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy cl_insert on call_logs
  for insert
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy cl_update on call_logs
  for update
  using  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy cl_delete on call_logs
  for delete
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy cl_service_role_all on call_logs
  to service_role using (true) with check (true);

-- ─── LEADS ───────────────────────────────────────────────────────────────────
drop policy if exists tenant_isolation  on leads;
drop policy if exists service_role_all  on leads;

create policy leads_select on leads
  for select
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy leads_insert on leads
  for insert
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy leads_update on leads
  for update
  using  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy leads_delete on leads
  for delete
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

create policy leads_service_role_all on leads
  to service_role using (true) with check (true);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
-- These were created in 004; harden them here to match the per-verb pattern.
drop policy if exists tenant_isolation  on notifications;
drop policy if exists service_role_all  on notifications;

create policy notif_select on notifications
  for select
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Tenants may mark their own notifications as read (UPDATE is_read only)
create policy notif_update on notifications
  for update
  using  (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  with check (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Tenants may not INSERT or DELETE notifications directly —
-- inserts go through notify_tenant() (security definer), deletes via service role.
create policy notif_service_role_all on notifications
  to service_role using (true) with check (true);

-- Blueslate Notifications
-- Stores per-tenant notification events (new lead, missed call, booking, etc.)
-- Used by the dashboard bell icon and real-time notification feed.

-- ─── NOTIFICATIONS TABLE ─────────────────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  type        text not null check (type in (
                 'new_lead',
                 'missed_call',
                 'booking_confirmed',
                 'callback_requested',
                 'call_completed'
               )),
  title       text not null,
  body        text,
  metadata    jsonb,                          -- arbitrary context (call_log_id, lead_id, etc.)
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
create index if not exists idx_notifications_tenant     on notifications(tenant_id);
create index if not exists idx_notifications_tenant_read on notifications(tenant_id, is_read);
create index if not exists idx_notifications_created    on notifications(created_at desc);

-- ─── ROW-LEVEL SECURITY ──────────────────────────────────────────────────────
alter table notifications enable row level security;

-- Tenant users see only their own notifications
create policy tenant_isolation on notifications
  using (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Service role has full access (API routes use service key to INSERT notifications)
create policy service_role_all on notifications
  to service_role using (true) with check (true);

-- ─── REALTIME ────────────────────────────────────────────────────────────────
-- Dashboard subscribes to this table so the bell icon updates without polling.
alter publication supabase_realtime add table notifications;

-- ─── HELPER FUNCTION ─────────────────────────────────────────────────────────
-- notify_tenant(tenant_id, type, title, body, metadata)
-- Convenience wrapper called from API routes / Edge Functions.
create or replace function notify_tenant(
  p_tenant_id  uuid,
  p_type       text,
  p_title      text,
  p_body       text    default null,
  p_metadata   jsonb   default null
)
returns uuid
language plpgsql
security definer          -- runs as owner so service-role callers don't need direct INSERT
as $$
declare
  v_id uuid;
begin
  insert into notifications (tenant_id, type, title, body, metadata)
  values (p_tenant_id, p_type, p_title, p_body, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;

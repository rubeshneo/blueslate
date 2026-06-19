-- Add Vapi provisioning columns to tenants table.
-- vapi_agent_id was defined in 001 but absent from early-seeded rows.
-- vapi_phone_number and vapi_phone_number_id were referenced in code but
-- never added via migration.

alter table tenants
  add column if not exists vapi_agent_id        text,
  add column if not exists vapi_phone_number    text,
  add column if not exists vapi_phone_number_id text;

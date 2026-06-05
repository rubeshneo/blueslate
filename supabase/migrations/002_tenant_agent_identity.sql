-- Add agent identity columns to tenants
alter table tenants
  add column if not exists agent_name     text not null default 'AI Receptionist',
  add column if not exists agent_greeting text not null default 'Hi! Thanks for calling. How can I help you today?';

-- Add unique constraint for knowledge_context upsert (URL scraper + vision upload)
alter table knowledge_context
  drop constraint if exists knowledge_context_tenant_url_unique;

alter table knowledge_context
  add constraint knowledge_context_tenant_url_unique unique (tenant_id, source_url);

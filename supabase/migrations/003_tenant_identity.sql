-- Tenant white-label identity fields
-- agent_name: the AI receptionist's display name (e.g. "Alex at XP League")
-- agent_greeting: opening line the AI uses at the start of every conversation

alter table tenants
  add column if not exists agent_name     text not null default 'Blueslate AI',
  add column if not exists agent_greeting text not null default 'Hi! Thanks for calling. How can I help you today?';

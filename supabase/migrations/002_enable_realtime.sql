-- Enable Supabase Realtime on leads and call_logs tables
-- Run this in Supabase Dashboard → SQL Editor

alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table call_logs;

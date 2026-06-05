import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { data, error } = await supabase
    .from('call_logs')
    .select('id, vapi_call_id, caller_number, started_at, duration_seconds, status, created_at')
    .limit(5)
  console.log('data:', data)
  console.log('error:', error)
}
run()

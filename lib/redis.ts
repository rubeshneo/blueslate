import { Redis } from '@upstash/redis'

// Graceful: if env vars are missing, redis is null and all helpers return safe defaults
let redis: Redis | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  created_at: string
}

function key(userId: string) {
  return `notifications:${userId}`
}

function parse(item: unknown): Notification {
  return typeof item === 'string' ? JSON.parse(item) : (item as Notification)
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  if (!redis) return []
  const items = await redis.lrange(key(userId), 0, 49)
  return items.map(parse)
}

export async function createNotification(
  userId: string,
  data: Pick<Notification, 'title' | 'message' | 'type'>
): Promise<Notification | null> {
  if (!redis) return null
  const notif: Notification = {
    id: crypto.randomUUID(),
    ...data,
    read: false,
    created_at: new Date().toISOString(),
  }
  const k = key(userId)
  await redis.lpush(k, JSON.stringify(notif))
  await redis.ltrim(k, 0, 49)
  return notif
}

export async function markOneRead(userId: string, notifId: string): Promise<void> {
  if (!redis) return
  const k = key(userId)
  const items = await redis.lrange(k, 0, 49)
  const updated = items.map((item) => {
    const n = parse(item)
    if (n.id === notifId) n.read = true
    return JSON.stringify(n)
  })
  if (updated.length > 0) {
    await redis.del(k)
    await redis.rpush(k, ...updated)
  }
}

export async function markAllRead(userId: string): Promise<void> {
  if (!redis) return
  const k = key(userId)
  const items = await redis.lrange(k, 0, 49)
  const updated = items.map((item) => {
    const n = parse(item)
    n.read = true
    return JSON.stringify(n)
  })
  if (updated.length > 0) {
    await redis.del(k)
    await redis.rpush(k, ...updated)
  }
}

export async function deleteNotification(userId: string, notifId: string): Promise<void> {
  if (!redis) return
  const k = key(userId)
  const items = await redis.lrange(k, 0, 49)
  const filtered = items.filter((item) => parse(item).id !== notifId).map((item) => {
    const n = parse(item)
    return JSON.stringify(n)
  })
  await redis.del(k)
  if (filtered.length > 0) await redis.rpush(k, ...filtered)
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────
// Sliding-window counter via Redis INCR + EXPIRE.
// Falls back to { allowed: true } when Redis is not configured (dev mode).

export async function rateLimit(
  identifier: string,  // e.g. `scrape:${tenantId}`
  limit:      number,  // max requests per window
  windowSecs: number,  // window duration in seconds
): Promise<{ allowed: boolean; remaining: number }> {
  if (!redis) return { allowed: true, remaining: limit }
  const k = `ratelimit:${identifier}`
  const count = await redis.incr(k)
  if (count === 1) await redis.expire(k, windowSecs)
  const remaining = Math.max(0, limit - count)
  return { allowed: count <= limit, remaining }
}

// ─── Outbound call budget ──────────────────────────────────────────────────────
// Each outbound AI call burns real Vapi minutes, so cap how many a tenant can make
// per calendar month. Protects the shared Vapi credit from runaway/abusive usage.
// Configure the cap with OUTBOUND_CALL_CAP (default 50). Fails open if Redis is
// unconfigured (dev), so local testing isn't blocked.

const OUTBOUND_CALL_CAP = Number(process.env.OUTBOUND_CALL_CAP ?? 50)

function callBudgetKey(tenantId: string): string {
  const month = new Date().toISOString().slice(0, 7) // YYYY-MM
  return `callbudget:${tenantId}:${month}`
}

export interface CallBudget { used: number; cap: number; remaining: number; allowed: boolean }

// Read-only view of the current month's usage (for dashboards).
export async function getCallBudget(tenantId: string): Promise<CallBudget> {
  if (!redis) return { used: 0, cap: OUTBOUND_CALL_CAP, remaining: OUTBOUND_CALL_CAP, allowed: true }
  const used = Number(await redis.get(callBudgetKey(tenantId))) || 0
  return { used, cap: OUTBOUND_CALL_CAP, remaining: Math.max(0, OUTBOUND_CALL_CAP - used), allowed: used < OUTBOUND_CALL_CAP }
}

// Atomically reserve one call against the monthly cap. Returns allowed:false when
// the tenant is over budget (and does NOT consume a slot in that case).
export async function reserveOutboundCall(tenantId: string): Promise<CallBudget> {
  if (!redis) return { used: 0, cap: OUTBOUND_CALL_CAP, remaining: OUTBOUND_CALL_CAP, allowed: true }
  const k = callBudgetKey(tenantId)
  const count = await redis.incr(k)
  if (count === 1) await redis.expire(k, 60 * 60 * 24 * 32) // ~1 month TTL
  if (count > OUTBOUND_CALL_CAP) {
    await redis.decr(k) // don't count denied attempts
    return { used: OUTBOUND_CALL_CAP, cap: OUTBOUND_CALL_CAP, remaining: 0, allowed: false }
  }
  return { used: count, cap: OUTBOUND_CALL_CAP, remaining: Math.max(0, OUTBOUND_CALL_CAP - count), allowed: true }
}

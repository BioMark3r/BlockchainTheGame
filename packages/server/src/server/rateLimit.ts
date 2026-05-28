const WINDOW_MS = 1000        // 1-second window
const MAX_MESSAGES = 10       // max 10 messages per second per connection
const BAN_DURATION_MS = 5000  // 5s cooldown after exceeding limit

interface Bucket {
  count: number
  windowStart: number
  bannedUntil: number
}

const buckets = new WeakMap<object, Bucket>()

export function checkRateLimit(ws: object): boolean {
  const now = Date.now()
  let bucket = buckets.get(ws)

  if (!bucket) {
    bucket = { count: 0, windowStart: now, bannedUntil: 0 }
    buckets.set(ws, bucket)
  }

  // Still in ban period
  if (now < bucket.bannedUntil) return false

  // New window
  if (now - bucket.windowStart > WINDOW_MS) {
    bucket.count = 0
    bucket.windowStart = now
  }

  bucket.count++

  if (bucket.count > MAX_MESSAGES) {
    bucket.bannedUntil = now + BAN_DURATION_MS
    return false
  }

  return true
}

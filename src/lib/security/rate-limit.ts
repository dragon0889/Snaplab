/**
 * Small in-memory sliding-window rate limiter (one instance per server process, which is what the single-container
 * VPS deployment runs). Swap the Map for a shared store such as Redis if the app is ever scaled to several replicas.
 */

interface Bucket {
  hits: number[];
}

const MAX_KEYS = 10_000;
const stores = new Map<string, Map<string, Bucket>>();

export interface LimitResult {
  limited: boolean;
  /** Seconds until the oldest hit leaves the window (for the Retry-After header). */
  retryAfter: number;
}

function prune(store: Map<string, Bucket>, now: number, windowMs: number) {
  for (const [key, bucket] of store) {
    if (bucket.hits.length === 0 || now - bucket.hits[bucket.hits.length - 1] >= windowMs) store.delete(key);
  }
}

/**
 * Records one hit for `key` and reports whether it exceeds `max` hits per `windowMs`.
 * `scope` keeps independent limits (e.g. "tutor" and "beta-login") from sharing counters.
 */
export function rateLimit(scope: string, key: string, max: number, windowMs: number): LimitResult {
  const now = Date.now();
  let store = stores.get(scope);
  if (!store) {
    store = new Map();
    stores.set(scope, store);
  }
  let bucket = store.get(key);
  if (!bucket) {
    if (store.size >= MAX_KEYS) prune(store, now, windowMs);
    // Still full after pruning: refuse new keys instead of clearing everyone's counters (which would be a bypass).
    if (store.size >= MAX_KEYS) return { limited: true, retryAfter: Math.ceil(windowMs / 1000) };
    bucket = { hits: [] };
    store.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  if (bucket.hits.length >= max) {
    return { limited: true, retryAfter: Math.max(1, Math.ceil((bucket.hits[0] + windowMs - now) / 1000)) };
  }
  bucket.hits.push(now);
  return { limited: false, retryAfter: 0 };
}

/**
 * The caller's IP. `X-Real-IP` is trusted only when `TRUST_PROXY=1` (set in docker-compose, where Caddy overwrites
 * the header with the real client address). Otherwise a client could invent any address and dodge the limit,
 * so every request shares one bucket.
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const ip = req.headers.get("x-real-ip")?.trim();
    if (ip && ip.length <= 64) return ip;
  }
  return "direct";
}

/** A counter that resets every UTC day, used as a spending cap on paid API calls. */
let capDay = "";
let capCount = 0;
export function dailyCapReached(max: number): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== capDay) {
    capDay = day;
    capCount = 0;
  }
  return capCount >= max;
}
export function countDaily() {
  capCount++;
}

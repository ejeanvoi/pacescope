/**
 * Simple in-memory sliding-window rate limiter.
 * Suitable for single-instance deployments. For multi-instance setups,
 * replace with a Redis-backed solution (e.g., Upstash Ratelimit).
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function rateLimit({
  interval,
  limit,
}: {
  /** Window size in milliseconds */
  interval: number;
  /** Max requests per window */
  limit: number;
}) {
  const entries = new Map<string, RateLimitEntry>();

  // Periodically clean up expired entries to prevent memory leaks
  const CLEANUP_INTERVAL = 60_000; // 1 minute
  let lastCleanup = Date.now();

  function cleanup() {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;
    for (const [key, entry] of entries) {
      if (now > entry.resetAt) {
        entries.delete(key);
      }
    }
  }

  return {
    check(key: string): { success: boolean; remaining: number } {
      cleanup();

      const now = Date.now();
      const entry = entries.get(key);

      if (!entry || now > entry.resetAt) {
        entries.set(key, { count: 1, resetAt: now + interval });
        return { success: true, remaining: limit - 1 };
      }

      if (entry.count >= limit) {
        return { success: false, remaining: 0 };
      }

      entry.count++;
      return { success: true, remaining: limit - entry.count };
    },
  };
}

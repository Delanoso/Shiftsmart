/**
 * Simple in-memory rate limiter (per process).
 * Good enough for single-company Option 2 installs.
 */
export function createRateLimiter({
  windowMs = 60_000,
  max = 120,
  keyFn = (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  message = 'Too many requests. Please try again shortly.',
} = {}) {
  const hits = new Map();

  function prune(now) {
    for (const [key, entry] of hits.entries()) {
      if (now - entry.windowStart >= windowMs) hits.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    if (hits.size > 5000) prune(now);

    const key = keyFn(req);
    let entry = hits.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { windowStart: now, count: 0 };
      hits.set(key, entry);
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (entry.count > max) {
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}

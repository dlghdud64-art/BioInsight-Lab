/**
 * Rate limiter using simple Map cache
 * Simple in-memory rate limiting (for production, consider Redis)
 */

interface RateLimitOptions {
  interval: number; // Time window in milliseconds
  maxRequests: number; // Max requests per interval
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Create cache for rate limiting (simple Map-based implementation)
const cache = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.resetTime + 60000) { // 1 minute after reset
      cache.delete(key);
    }
  }
  // Limit cache size to prevent memory issues
  if (cache.size > 10000) {
    const keysToDelete = Array.from(cache.keys()).slice(0, cache.size - 5000);
    keysToDelete.forEach(key => cache.delete(key));
  }
}, 5 * 60 * 1000);

/**
 * Check if request is rate limited
 * Returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { interval: 60 * 1000, maxRequests: 60 }
): { allowed: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  const entry = cache.get(identifier);

  if (!entry || now > entry.resetTime) {
    // First request or expired window - allow and create new entry
    cache.set(identifier, {
      count: 1,
      resetTime: now + options.interval,
    });

    return {
      allowed: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - 1,
      reset: now + options.interval,
    };
  }

  // Check if under limit
  if (entry.count < options.maxRequests) {
    entry.count++;
    cache.set(identifier, entry);

    return {
      allowed: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - entry.count,
      reset: entry.resetTime,
    };
  }

  // Rate limited
  return {
    allowed: false,
    limit: options.maxRequests,
    remaining: 0,
    reset: entry.resetTime,
  };
}

/**
 * Get client IP from request
 */
export function getClientIp(request: Request): string {
  // Try various headers (in order of preference)
  const headers = request.headers;

  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take first IP if comma-separated
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // Fallback
  return "unknown";
}

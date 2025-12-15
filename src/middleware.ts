import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiting store
// Note: This resets on serverless function cold starts. For production at scale,
// consider using Redis or a similar distributed store.
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

// Rate limit configurations for different route patterns
const rateLimitConfigs: Record<string, RateLimitConfig> = {
  '/api/stripe': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,     // 20 requests per minute
  },
  '/api/clients/invite': {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,     // 10 requests per minute (invitations are expensive)
  },
};

function getClientIdentifier(request: NextRequest): string {
  // Use X-Forwarded-For header for clients behind proxies, fallback to IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const ip = forwardedFor?.split(',')[0]?.trim() || 'unknown';
  return ip;
}

function getRateLimitConfig(pathname: string): RateLimitConfig | null {
  for (const [pattern, config] of Object.entries(rateLimitConfigs)) {
    if (pathname.startsWith(pattern)) {
      return config;
    }
  }
  return null;
}

function checkRateLimit(
  identifier: string,
  pathname: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetTime: number } {
  const key = `${identifier}:${pathname}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    // First request or window expired - create new record
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: config.maxRequests - 1, resetTime };
  }

  if (record.count >= config.maxRequests) {
    // Rate limit exceeded
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  // Increment counter
  record.count++;
  rateLimitStore.set(key, record);
  return {
    allowed: true,
    remaining: config.maxRequests - record.count,
    resetTime: record.resetTime,
  };
}

// Cleanup old entries periodically (every 5 minutes)
// This prevents memory leaks from accumulating stale entries
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply rate limiting to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Get rate limit config for this route
  const config = getRateLimitConfig(pathname);
  if (!config) {
    // No rate limiting configured for this route
    return NextResponse.next();
  }

  // Cleanup stale entries occasionally
  cleanupStaleEntries();

  // Check rate limit
  const identifier = getClientIdentifier(request);
  const { allowed, remaining, resetTime } = checkRateLimit(
    identifier,
    pathname.split('/').slice(0, 4).join('/'), // Group by route prefix
    config
  );

  if (!allowed) {
    const retryAfter = Math.ceil((resetTime - Date.now()) / 1000);
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
        },
      }
    );
  }

  // Add rate limit headers to successful responses
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', Math.ceil(resetTime / 1000).toString());

  return response;
}

// Configure which routes the middleware runs on
export const config = {
  matcher: [
    '/api/stripe/:path*',
    '/api/clients/invite/:path*',
  ],
};

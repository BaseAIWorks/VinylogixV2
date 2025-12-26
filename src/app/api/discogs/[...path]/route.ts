import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const DISCOGS_API_BASE_URL = 'https://api.discogs.com';
const USER_AGENT = 'VinylogixApp/1.0';
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;

// Rate limiting: Track requests per IP
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 25; // requests per minute (Discogs allows 60/min for authenticated)
const RATE_WINDOW = 60 * 1000; // 1 minute in ms

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  return ip;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1, resetIn: RATE_WINDOW };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count, resetIn: record.resetTime - now };
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(key);
    }
  }
}, 60 * 1000);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;

  // Check rate limit
  const rateLimitKey = getRateLimitKey(request);
  const rateLimit = checkRateLimit(rateLimitKey);

  if (!rateLimit.allowed) {
    logger.warn('Discogs proxy rate limit exceeded', { ip: rateLimitKey });
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }

  if (!DISCOGS_TOKEN) {
    logger.error('Discogs API token not configured');
    return NextResponse.json(
      { error: 'Discogs API is not configured' },
      { status: 500 }
    );
  }

  // Build the Discogs URL
  const pathString = path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const discogsUrl = `${DISCOGS_API_BASE_URL}/${pathString}${searchParams ? `?${searchParams}` : ''}`;

  logger.api('GET', `/api/discogs/${pathString}`, { query: searchParams });

  try {
    const response = await fetch(discogsUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Authorization': `Discogs token=${DISCOGS_TOKEN}`,
      },
    });

    // Forward Discogs rate limit headers
    const discogsRemaining = response.headers.get('X-Discogs-Ratelimit-Remaining');

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Discogs API error', new Error(errorText), {
        status: response.status,
        path: pathString
      });

      return NextResponse.json(
        { error: `Discogs API error: ${response.statusText}` },
        {
          status: response.status,
          headers: {
            'X-RateLimit-Remaining': String(rateLimit.remaining),
          }
        }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'X-RateLimit-Remaining': String(rateLimit.remaining),
        'X-Discogs-Ratelimit-Remaining': discogsRemaining || 'unknown',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      }
    });
  } catch (error) {
    logger.error('Discogs proxy fetch error', error as Error, { path: pathString });
    return NextResponse.json(
      { error: 'Failed to fetch from Discogs' },
      { status: 500 }
    );
  }
}

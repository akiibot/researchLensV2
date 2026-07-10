import { NextResponse } from 'next/server';
import { ApiError } from './types';

/**
 * Best-effort, in-memory per-instance rate limiting and request body size
 * guards. This does not coordinate across multiple serverless instances —
 * it exists to blunt the obvious cases (a script hammering a single warm
 * instance, an oversized payload) rather than to provide hard multi-tenant
 * guarantees.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Periodically drop expired buckets so this map doesn't grow unbounded on a
// long-running instance.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't keep the process alive just for cleanup.
  (timer as unknown as { unref?: () => void }).unref?.();
}

export function getClientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}

/**
 * Returns a 429 NextResponse if the caller has exceeded `limit` requests to
 * `routeKey` within `windowMs`, or null if the request may proceed.
 */
export function enforceRateLimit(
  request: Request,
  routeKey: string,
  limit: number,
  windowMs: number
): NextResponse<ApiError> | null {
  const key = `${routeKey}:${getClientKey(request)}`;
  const result = checkRateLimit(key, limit, windowMs);
  if (result.allowed) return null;

  return NextResponse.json<ApiError>(
    { error: 'Too many requests. Please try again shortly.', code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: result.retryAfterSeconds
        ? { 'Retry-After': String(result.retryAfterSeconds) }
        : undefined,
    }
  );
}

export class BodyTooLargeError extends Error {
  constructor() {
    super('Request body is too large.');
    this.name = 'BodyTooLargeError';
  }
}

/**
 * Reads and JSON-parses a request body while enforcing a hard byte cap,
 * regardless of whether the caller sends an honest Content-Length header.
 */
export async function readJsonWithLimit<T = unknown>(
  request: Request,
  maxBytes: number
): Promise<T> {
  const reader = request.body?.getReader();
  if (!reader) {
    return request.json() as Promise<T>;
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(combined);
  return text ? (JSON.parse(text) as T) : ({} as T);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

/**
 * 32 hex chars (128 bits) of crypto-random entropy. Unguessable.
 * Uses Web Crypto (available in both browser and Node runtimes) so this
 * module stays free of Node-only deps and can be imported from any file.
 */
export function generateTrackingToken(): string {
  const bytes = new Uint8Array(16);
  const c: Crypto | undefined =
    (typeof globalThis !== 'undefined' && (globalThis as any).crypto) as Crypto | undefined;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('Web Crypto is not available in this environment.');
  }
  c.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function buildTrackingUrl(token: string): string {
  return `${SITE_URL}/t/${token}`;
}

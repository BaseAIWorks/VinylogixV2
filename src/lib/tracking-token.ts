import crypto from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

/**
 * 32 hex chars (128 bits) of crypto-random entropy. Unguessable.
 */
export function generateTrackingToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Returns the order's trackingToken, generating and persisting one if missing.
 * Idempotent — safe to call multiple times. Returns null only if admin DB is unavailable
 * or the order doesn't exist.
 */
export async function ensureTrackingToken(orderId: string): Promise<string | null> {
  const adminDb = getAdminDb();
  if (!adminDb) return null;

  const ref = adminDb.collection('orders').doc(orderId);
  const snap = await ref.get();
  if (!snap.exists) return null;

  const existing = (snap.data() as any)?.trackingToken as string | undefined;
  if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;

  const token = generateTrackingToken();
  await ref.update({ trackingToken: token });
  return token;
}

export function buildTrackingUrl(token: string): string {
  return `${SITE_URL}/t/${token}`;
}

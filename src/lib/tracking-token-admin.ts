import { getAdminDb } from '@/lib/firebase-admin';
import { generateTrackingToken } from '@/lib/tracking-token';

/**
 * Returns the order's trackingToken, generating and persisting one if missing.
 * Idempotent — safe to call multiple times. Returns null only if admin DB is
 * unavailable or the order doesn't exist.
 *
 * Server-only: pulls in `firebase-admin`. Do NOT import this from modules
 * that end up in the client bundle — see sibling `tracking-token.ts` for
 * the browser-safe helpers.
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

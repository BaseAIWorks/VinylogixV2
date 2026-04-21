// Order-number generator. Replaces the legacy per-distributor `orderCounter`
// approach (which required a Firestore transaction on the distributor doc
// for every order — a ~1 write/sec/doc hard ceiling).
//
// Format: {PREFIX}-{YYYYMMDD}-{6 hex chars}
// Example: ABC-20260421-4AF89C
//
// - Human-readable and chronologically sortable by prefix scan.
// - 16.7M combos per day per distributor → collision risk is effectively
//   zero at any realistic volume, and the number is per-distributor-display-
//   only (not a primary key), so even a theoretical collision is harmless.
// - Uses Web Crypto so the same helper works in both Node (server) and
//   browser (client-side createOrder) without a runtime branch.

function randomHex(byteCount: number): string {
  const buf = new Uint8Array(byteCount);
  const c: Crypto | undefined =
    (typeof globalThis !== 'undefined' && (globalThis as any).crypto) as Crypto | undefined;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('Web Crypto is not available in this environment.');
  }
  c.getRandomValues(buf);
  return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function generateOrderNumber(prefix: string | null | undefined, now: Date = new Date()): string {
  const safePrefix = (prefix || 'ORD').replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'ORD';
  const yyyy = now.getFullYear();
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  return `${safePrefix}-${yyyy}${mm}${dd}-${randomHex(3)}`;
}

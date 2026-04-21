// Order-number allocator. Returns a sequential PREFIX-NNNNN number per
// distributor by atomically incrementing `orderCounter` inside a focused
// Firestore transaction on the distributor document.
//
// Format: {PREFIX}-{5-digit zero-padded counter}
// Example: THA-00014
//
// The transaction body is kept to exactly one read + one write so Firestore's
// automatic retry-on-contention can resolve concurrent allocations quickly.
// Throughput is bounded to ~1 order/sec per distributor under sustained
// contention — an acceptable trade-off for human-readable, bookkeeping-
// friendly order numbers.

import type { Firestore as AdminFirestore, DocumentData } from 'firebase-admin/firestore';

const DISTRIBUTORS_COLLECTION = 'distributors';

function sanitizePrefix(prefix: string | null | undefined): string {
  const safe = (prefix || 'ORD').replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
  return safe || 'ORD';
}

export function formatOrderNumber(prefix: string | null | undefined, counter: number): string {
  return `${sanitizePrefix(prefix)}-${counter.toString().padStart(5, '0')}`;
}

export async function allocateOrderNumberAdmin(
  adminDb: AdminFirestore,
  distributorId: string,
): Promise<{ orderNumber: string; counter: number; distributor: DocumentData }> {
  const ref = adminDb.collection(DISTRIBUTORS_COLLECTION).doc(distributorId);
  return await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error(`Distributor with ID ${distributorId} not found`);
    }
    const data = snap.data()!;
    const current = typeof data.orderCounter === 'number' ? data.orderCounter : 0;
    const next = current + 1;
    tx.update(ref, { orderCounter: next });
    return {
      orderNumber: formatOrderNumber(data.orderIdPrefix, next),
      counter: next,
      distributor: data,
    };
  });
}

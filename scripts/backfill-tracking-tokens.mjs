#!/usr/bin/env node
/**
 * Assign a `trackingToken` to every order that doesn't already have one.
 * Orders created before the customer-facing tracking feature existed have no
 * token, so the "Customer view" button on the order-detail page is hidden
 * for them. This script backfills them so the button appears everywhere.
 *
 * Usage:
 *   node scripts/backfill-tracking-tokens.mjs --list         # preview orders missing a token
 *   node scripts/backfill-tracking-tokens.mjs --dry-run      # count what would be written, no changes
 *   node scripts/backfill-tracking-tokens.mjs                # write tokens to every order missing one
 *
 * Idempotent: orders that already have a valid 32-hex-char token are skipped.
 * Uses a transaction per order so a concurrent mutation (order edit, status
 * change) can't be overwritten.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const flags = process.argv.slice(2);
const listMode = flags.includes('--list');
const dryRun = flags.includes('--dry-run');

const serviceAccount = JSON.parse(
  readFileSync('/Users/saliano/VibeWorks/Vinylogix/docs/vinylogix-v1-firebase-adminsdk-fbsvc-5fb9a73b67.json', 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const TOKEN_FORMAT = /^[a-f0-9]{32}$/;

function generateTrackingToken() {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function needsBackfill(data) {
  const t = data?.trackingToken;
  return typeof t !== 'string' || !TOKEN_FORMAT.test(t);
}

async function collectMissing() {
  const snap = await db.collection('orders').get();
  const missing = [];
  for (const doc of snap.docs) {
    if (needsBackfill(doc.data())) {
      const d = doc.data();
      missing.push({
        orderId: doc.id,
        distributorId: d.distributorId,
        orderNumber: d.orderNumber || null,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
      });
    }
  }
  missing.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  return { total: snap.size, missing };
}

async function backfillOne(orderId) {
  return await db.runTransaction(async (tx) => {
    const ref = db.collection('orders').doc(orderId);
    const snap = await tx.get(ref);
    if (!snap.exists) return { status: 'gone' };
    const data = snap.data();
    if (!needsBackfill(data)) return { status: 'already-present', token: data.trackingToken };
    const token = generateTrackingToken();
    tx.update(ref, { trackingToken: token });
    return { status: 'backfilled', token };
  });
}

async function main() {
  const { total, missing } = await collectMissing();

  if (listMode) {
    console.log(JSON.stringify({
      totalOrders: total,
      missing: missing.length,
      orders: missing,
    }, null, 2));
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify({
      totalOrders: total,
      wouldBackfill: missing.length,
      dryRun: true,
    }, null, 2));
    return;
  }

  if (missing.length === 0) {
    console.log(JSON.stringify({ totalOrders: total, backfilled: 0, note: 'nothing to do' }, null, 2));
    return;
  }

  let ok = 0;
  let skipped = 0;
  const errors = [];
  for (let i = 0; i < missing.length; i++) {
    const { orderId } = missing[i];
    try {
      const result = await backfillOne(orderId);
      if (result.status === 'backfilled') ok++;
      else skipped++;
    } catch (err) {
      errors.push({ orderId, error: err?.message || String(err) });
    }
    if ((i + 1) % 25 === 0) {
      process.stderr.write(`... ${i + 1}/${missing.length}\n`);
    }
  }

  console.log(JSON.stringify({
    totalOrders: total,
    attempted: missing.length,
    backfilled: ok,
    skippedAlreadyPresent: skipped,
    errors,
  }, null, 2));

  if (errors.length > 0) process.exit(1);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

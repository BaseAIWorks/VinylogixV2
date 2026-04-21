#!/usr/bin/env node
/**
 * Fix an order's `orderNumber` to the correct sequential format by allocating
 * the next counter value from its distributor.
 *
 * Usage:
 *   node scripts/fix-order-number.mjs --list                       # list orders with the old PREFIX-YYYYMMDD-XXXXXX format
 *   node scripts/fix-order-number.mjs <orderId>                    # fix one order
 *   node scripts/fix-order-number.mjs <orderId> --dry-run          # preview only
 *   node scripts/fix-order-number.mjs <orderId> --force            # re-assign even if already sequential
 *
 * The order is read inside the transaction so concurrent writes (item-status
 * changes, discounts, etc.) can't be clobbered. By default the script refuses
 * to re-assign an order that already has a sequential number, so re-running
 * won't double-bump the counter.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const [, , arg, ...flags] = process.argv;
const dryRun = flags.includes('--dry-run');
const force = flags.includes('--force');
const listMode = arg === '--list';

if (!arg) {
  console.error('Usage:');
  console.error('  node scripts/fix-order-number.mjs --list');
  console.error('  node scripts/fix-order-number.mjs <orderId> [--dry-run] [--force]');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  readFileSync('/Users/saliano/VibeWorks/Vinylogix/docs/vinylogix-v1-firebase-adminsdk-fbsvc-5fb9a73b67.json', 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

function sanitizePrefix(prefix) {
  const safe = (prefix || 'ORD').replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
  return safe || 'ORD';
}

function formatOrderNumber(prefix, counter) {
  return `${sanitizePrefix(prefix)}-${counter.toString().padStart(5, '0')}`;
}

// Matches the broken PREFIX-YYYYMMDD-XXXXXX format (6 hex chars).
const LEGACY_TIMESTAMP_FORMAT = /^[A-Z0-9]{1,8}-\d{8}-[A-F0-9]{6}$/;
// Matches the sequential PREFIX-NNNNN format (5+ digits). Used to guard
// against double-bumping the counter if the script is re-run.
const SEQUENTIAL_FORMAT = /^[A-Z0-9]{1,8}-\d{5,}$/;

async function listBrokenOrders() {
  const snap = await db.collection('orders').get();
  const broken = [];
  for (const doc of snap.docs) {
    const data = doc.data();
    if (typeof data.orderNumber === 'string' && LEGACY_TIMESTAMP_FORMAT.test(data.orderNumber)) {
      broken.push({
        orderId: doc.id,
        distributorId: data.distributorId,
        orderNumber: data.orderNumber,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      });
    }
  }
  // Sort oldest-first so the user can fix them in creation order — otherwise
  // counters get assigned out of chronological sequence.
  broken.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  console.log(JSON.stringify({ count: broken.length, orders: broken }, null, 2));
}

async function main() {
  if (listMode) {
    await listBrokenOrders();
    return;
  }
  const orderIdArg = arg;
  const orderRef = db.collection('orders').doc(orderIdArg);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    console.error(`Order ${orderIdArg} not found.`);
    process.exit(1);
  }
  const order = orderSnap.data();
  const distributorId = order.distributorId;
  if (!distributorId) {
    console.error(`Order ${orderIdArg} has no distributorId.`);
    process.exit(1);
  }

  const distributorRef = db.collection('distributors').doc(distributorId);

  if (dryRun) {
    const distSnap = await distributorRef.get();
    if (!distSnap.exists) {
      console.error(`Distributor ${distributorId} not found.`);
      process.exit(1);
    }
    const dist = distSnap.data();
    const alreadySequential = typeof order.orderNumber === 'string' && SEQUENTIAL_FORMAT.test(order.orderNumber);
    const wouldSkip = alreadySequential && !force;
    const next = (typeof dist.orderCounter === 'number' ? dist.orderCounter : 0) + 1;
    console.log(JSON.stringify({
      orderId: orderIdArg,
      distributorId,
      prefix: dist.orderIdPrefix,
      currentCounter: dist.orderCounter || 0,
      oldOrderNumber: order.orderNumber || null,
      wouldBecome: wouldSkip ? null : formatOrderNumber(dist.orderIdPrefix, next),
      wouldSkipReason: wouldSkip ? 'already-sequential (pass --force to override)' : null,
      dryRun: true,
    }, null, 2));
    process.exit(wouldSkip ? 2 : 0);
  }

  const result = await db.runTransaction(async (tx) => {
    // Re-read the order inside the transaction so a concurrent write (e.g.
    // an operator editing items) either wins and we see its effect or we
    // retry; we never clobber their change.
    const freshOrderSnap = await tx.get(orderRef);
    if (!freshOrderSnap.exists) {
      throw new Error(`Order ${orderIdArg} disappeared during transaction`);
    }
    const freshOrder = freshOrderSnap.data();

    if (!force && typeof freshOrder.orderNumber === 'string' && SEQUENTIAL_FORMAT.test(freshOrder.orderNumber)) {
      const err = new Error(
        `Order already has a sequential number: ${freshOrder.orderNumber}. ` +
        `Re-running would skip a counter value. Pass --force to override.`
      );
      err.code = 'ALREADY_SEQUENTIAL';
      throw err;
    }

    const distSnap = await tx.get(distributorRef);
    if (!distSnap.exists) {
      throw new Error(`Distributor ${distributorId} not found`);
    }
    const dist = distSnap.data();
    const current = typeof dist.orderCounter === 'number' ? dist.orderCounter : 0;
    const next = current + 1;
    const newOrderNumber = formatOrderNumber(dist.orderIdPrefix, next);

    tx.update(distributorRef, { orderCounter: next });
    tx.update(orderRef, { orderNumber: newOrderNumber });

    return { previous: freshOrder.orderNumber || null, next: newOrderNumber, counter: next };
  });

  console.log(JSON.stringify({
    orderId: orderIdArg,
    distributorId,
    previousOrderNumber: result.previous,
    newOrderNumber: result.next,
    newCounter: result.counter,
  }, null, 2));
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err?.message || err);
  // Exit 2 when the guard fires so automation can distinguish
  // "already done" from a real error.
  process.exit(err?.code === 'ALREADY_SEQUENTIAL' ? 2 : 1);
});

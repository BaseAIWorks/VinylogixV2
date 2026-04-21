
"use client";

import type { Order, OrderStatus, OrderItemStatus, OrderAssignmentEvent, User, OrderItem } from '@/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, limit, Timestamp, runTransaction } from 'firebase/firestore';
import {
  deductStockForOrder,
  deductReservedStockForOrder,
  releaseStockForOrder,
  restoreStockForOrder,
  getRecordById,
} from './record-service';
import { getDistributorById } from './distributor-service';
import { logger } from '@/lib/logger';

const ORDERS_COLLECTION = 'orders';

const processOrderTimestamps = (orderData: any): Order => {
  const processed = { ...orderData };
  // Every Firestore Timestamp field we might read must be converted to ISO —
  // the UI calls format(new Date(order.paidAt)) etc. and date-fns throws
  // "Invalid time value" when handed a Timestamp object.
  const tsFields = [
    'createdAt',
    'updatedAt',
    'paidAt',
    'approvedAt',
    'shippedAt',
    'itemChangesNotifiedAt',
    'invoiceEmailedAt',
    'paymentLinkCreatedAt',
  ] as const;
  for (const field of tsFields) {
    if (processed[field] && processed[field] instanceof Timestamp) {
      processed[field] = processed[field].toDate().toISOString();
    }
  }
  // Nested Timestamp inside paymentAmountMismatch.detectedAt (set by the
  // Stripe webhook when an amount mismatch is detected).
  if (processed.paymentAmountMismatch && typeof processed.paymentAmountMismatch === 'object') {
    const m = { ...processed.paymentAmountMismatch };
    if (m.detectedAt && m.detectedAt instanceof Timestamp) {
      m.detectedAt = m.detectedAt.toDate().toISOString();
    }
    processed.paymentAmountMismatch = m;
  }
  return processed as Order;
};


export async function getOrders(user: User): Promise<Order[]> {
  const targetDistributorId = user.distributorId;
  if (!targetDistributorId) {
      logger.warn("OrderService: User has no distributorId, cannot fetch orders");
      return [];
  }
  const ordersCollectionRef = collection(db, ORDERS_COLLECTION);
  try {
      const q = query(ordersCollectionRef, where("distributorId", "==", targetDistributorId));
      const querySnapshot = await getDocs(q);
      const orders = querySnapshot.docs.map(docSnap => processOrderTimestamps({ ...docSnap.data(), id: docSnap.id }));
      return orders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch(error) {
      logger.error("OrderService: Error fetching orders", error as Error);
      throw error;
  }
}

export async function getOrdersByDistributorId(distributorId: string): Promise<Order[]> {
    if (!distributorId) {
        logger.warn("OrderService: Distributor ID is missing, cannot fetch orders");
        return [];
    }
    const ordersCollectionRef = collection(db, ORDERS_COLLECTION);
    try {
        const q = query(ordersCollectionRef, where("distributorId", "==", distributorId));
        const querySnapshot = await getDocs(q);
        const orders = querySnapshot.docs.map(docSnap => processOrderTimestamps({ ...docSnap.data(), id: docSnap.id }));
        return orders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch(error) {
        logger.error(`OrderService: Error fetching orders for distributor ${distributorId}`, error as Error);
        throw error;
    }
}


export async function getOrdersByViewerId(viewerId: string): Promise<Order[]> {
  const ordersCollectionRef = collection(db, ORDERS_COLLECTION);
  try {
    const q = query(ordersCollectionRef, where("viewerId", "==", viewerId));
    const querySnapshot = await getDocs(q);
    const orders = querySnapshot.docs.map(docSnap => processOrderTimestamps({ ...docSnap.data(), id: docSnap.id }));
    return orders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch(error) {
    logger.error(`OrderService: Error fetching orders for viewer ${viewerId}`, error as Error);
    throw error;
  }
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
  try {
      const docSnap = await getDoc(orderDocRef);
      if (docSnap.exists()) {
          return processOrderTimestamps({ ...docSnap.data(), id: docSnap.id });
      }
      return null;
  } catch (error) {
      logger.error(`OrderService: Error fetching order ${orderId}`, error as Error);
      throw error;
  }
}


export async function updateOrderStatus(orderId: string, status: OrderStatus, actingUser: User): Promise<Order | null> {
    if (!actingUser.distributorId) throw new Error("User has no distributorId.");

    const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderSnap = await getDoc(orderDocRef);

    if (!orderSnap.exists() || orderSnap.data().distributorId !== actingUser.distributorId) {
        throw new Error("Permission Denied or Order not found.");
    }
    
    const orderData = orderSnap.data() as Order;
    const oldStatus = orderData.status;
    const currentStockState: Order['stockState'] = orderData.stockState || 'none';
    let nextStockState: Order['stockState'] = currentStockState;

    // Only items the customer is actually paying for should affect physical stock.
    // Anything the distributor marked not_available / out_of_stock should have its
    // earlier reservation released instead.
    const isBillable = (i: OrderItem) => {
        const s = i.itemStatus || 'available';
        return s === 'available' || s === 'back_order';
    };
    const billableItems = orderData.items.filter(isBillable);
    const nonBillableItems = orderData.items.filter(i => !isBillable(i));

    // Deduct stock when marking as paid
    if (status === 'paid' && oldStatus !== 'paid') {
        try {
            if (currentStockState === 'reserved') {
                if (nonBillableItems.length > 0) {
                    await releaseStockForOrder(nonBillableItems);
                }
                await deductReservedStockForOrder(billableItems, actingUser.email);
            } else if (currentStockState !== 'deducted') {
                // Legacy order with no reservation — fall back to a direct deduct.
                await deductStockForOrder(billableItems, orderData.distributorId, actingUser);
            }
            nextStockState = 'deducted';
        } catch (error) {
            logger.error(`Failed to deduct stock for order ${orderId}`, error as Error);
            // Re-throw the error to prevent status update if stock deduction fails, and show it to the user.
            throw error;
        }
    }

    // Cancelling clears stock claim: release if only reserved, restore if already deducted.
    if (status === 'cancelled' && oldStatus !== 'cancelled') {
        try {
            if (currentStockState === 'reserved') {
                await releaseStockForOrder(orderData.items);
            } else if (currentStockState === 'deducted') {
                await restoreStockForOrder(orderData.items, actingUser);
            }
            nextStockState = 'none';
        } catch (error) {
            logger.error(`Failed to clear stock claim for cancelled order ${orderId}`, error as Error);
            // Don't re-throw here, as cancelling the order is the primary goal even if stock ops fail.
        }
    }

    const updatePayload: any = {
        status: status,
        updatedAt: Timestamp.now(),
    };

    if (nextStockState !== currentStockState) {
        updatePayload.stockState = nextStockState;
    }

    // Add shippedAt timestamp when marking as shipped
    if (status === 'shipped' && oldStatus !== 'shipped') {
        updatePayload.shippedAt = Timestamp.now();
    }

    await updateDoc(orderDocRef, updatePayload);

    const updatedSnap = await getDoc(orderDocRef);
    const updatedOrder = processOrderTimestamps({ ...updatedSnap.data(), id: updatedSnap.id });

    // Send shipping notification email if status changed to shipped
    if (status === 'shipped' && oldStatus !== 'shipped') {
        try {
            const { sendShippingNotification } = await import('./email-service');
            sendShippingNotification(updatedOrder).catch(err =>
                logger.error('Failed to send shipping notification', err as Error)
            );
        } catch (error) {
            logger.error('Failed to import email service', error as Error);
        }
    }

    return updatedOrder;
}

export async function updateOrderItemStatuses(
  orderId: string,
  changes: Array<{ recordId: string; itemStatus: OrderItemStatus; quantity?: number }>,
  actingUser: User
): Promise<Order> {
  if (!actingUser.distributorId) throw new Error("User has no distributorId.");

  const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
  const orderSnap = await getDoc(orderDocRef);

  if (!orderSnap.exists() || orderSnap.data().distributorId !== actingUser.distributorId) {
    throw new Error("Permission Denied or Order not found.");
  }

  const orderData = orderSnap.data() as Order;

  // Build a lookup for the changes
  const changeMap = new Map(changes.map(c => [c.recordId, { itemStatus: c.itemStatus, quantity: c.quantity }]));

  // Update item statuses and quantities
  const updatedItems = orderData.items.map(item => {
    const change = changeMap.get(item.recordId);
    if (change) {
      return {
        ...item,
        itemStatus: change.itemStatus,
        ...(change.quantity !== undefined ? { quantity: change.quantity } : {}),
      };
    }
    return item;
  });

  // Sync reservations for orders still in 'reserved' state. An item that
  // becomes unavailable releases its hold; quantity reductions release the
  // delta. Quantity increases or flipping a non-billable item back to
  // billable would need a fresh stock check — which could race with other
  // pending orders — so those are rejected explicitly instead of silently
  // leaving the reservation under-held.
  if ((orderData.stockState || 'none') === 'reserved') {
    const isBillable = (s?: OrderItemStatus) => {
      const v = s || 'available';
      return v === 'available' || v === 'back_order';
    };
    const releases: OrderItem[] = [];
    for (const beforeItem of orderData.items) {
      const change = changeMap.get(beforeItem.recordId);
      if (!change) continue;
      const beforeActive = isBillable(beforeItem.itemStatus);
      const afterActive = isBillable(change.itemStatus);
      const beforeQty = beforeItem.quantity || 0;
      const afterQty = change.quantity !== undefined ? change.quantity : beforeQty;
      const heldBefore = beforeActive ? beforeQty : 0;
      const heldAfter = afterActive ? afterQty : 0;
      const delta = heldBefore - heldAfter;
      if (delta > 0) {
        releases.push({ ...beforeItem, quantity: delta });
      } else if (delta < 0) {
        throw new Error(
          `Cannot increase reserved quantity for "${beforeItem.title}" on an open order. ` +
          `Cancel this order and create a new one if more stock is needed.`
        );
      }
    }
    if (releases.length > 0) {
      try {
        await releaseStockForOrder(releases);
      } catch (err) {
        logger.warn(`Failed to sync reservations for order ${orderId}`, { err: (err as Error).message });
      }
    }
  }

  // Preserve original totals on first adjustment (for display only — strike-through)
  const originalTotalAmount = orderData.originalTotalAmount ?? orderData.totalAmount;
  const originalSubtotalAmount = orderData.originalSubtotalAmount ?? orderData.subtotalAmount;

  // Recalculate totals — exclude not_available and out_of_stock items
  const activeItems = updatedItems.filter(item => {
    const status = item.itemStatus || 'available';
    return status === 'available' || status === 'back_order';
  });

  // Sum of priceAtTimeOfOrder × quantity. This sum is in the SAME convention as
  // the stored price (inclusive of tax if the distributor operates inclusive,
  // exclusive otherwise) — it matches how recalculateOrderTax treats itemTotal.
  const itemTotal = activeItems.reduce((sum, item) => sum + (item.priceAtTimeOfOrder * item.quantity), 0);
  const shippingCost = orderData.shippingCost || 0;

  // Use the tax rate that was SAVED on the order at time of approval/creation,
  // not the distributor's current setting — historical orders should keep
  // their original tax treatment even if the distributor later changes rate.
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const storedRate = orderData.taxRate;
  const inclusive = orderData.taxInclusive === true;
  const reverseCharge = orderData.isReverseCharge === true;
  const hasBreakdown = Array.isArray(orderData.taxBreakdown) && orderData.taxBreakdown.length > 0;

  let newSubtotal: number; // always tax-exclusive (matches recalculateOrderTax convention)
  let newTaxAmount: number | undefined;
  let newTotal: number;
  let newTaxBreakdown: Order['taxBreakdown'] | undefined;

  if (hasBreakdown && originalSubtotalAmount && originalSubtotalAmount > 0 && orderData.taxAmount !== undefined) {
    // Multi-rate order (typically Stripe Tax). We can't re-derive individual
    // rates without re-hitting Stripe Tax, so we proportionally scale every
    // bucket by the item-subtotal ratio and keep the totals consistent.
    const inclusiveItems = inclusive;
    const productsExcl = inclusiveItems ? round2(itemTotal / (1 + ((storedRate || 0) / 100))) : itemTotal;
    const shippingExcl = inclusiveItems && storedRate ? round2(shippingCost / (1 + (storedRate / 100))) : shippingCost;
    const ratio = originalSubtotalAmount > 0 ? (productsExcl / originalSubtotalAmount) : 1;
    newTaxBreakdown = orderData.taxBreakdown!.map(t => ({
      ...t,
      amount: round2((t.amount || 0) * ratio),
    }));
    newTaxAmount = round2(newTaxBreakdown.reduce((s, t) => s + (t.amount || 0), 0));
    newSubtotal = productsExcl;
    newTotal = inclusiveItems
      ? round2(itemTotal + shippingCost) // inclusive total is items+shipping; tax is a component within
      : round2(newSubtotal + shippingExcl + newTaxAmount);
  } else if (typeof storedRate === 'number' && (storedRate > 0 || reverseCharge)) {
    // Single-rate order — do the exact math using the historical rate.
    if (inclusive) {
      const productsExcl = round2(itemTotal / (1 + (storedRate / 100)));
      const shippingExcl = round2(shippingCost / (1 + (storedRate / 100)));
      newSubtotal = productsExcl;
      if (reverseCharge) {
        newTaxAmount = 0;
        newTotal = round2(productsExcl + shippingExcl);
      } else {
        newTaxAmount = round2((itemTotal + shippingCost) - (productsExcl + shippingExcl));
        newTotal = round2(itemTotal + shippingCost);
      }
    } else {
      newSubtotal = itemTotal;
      if (reverseCharge) {
        newTaxAmount = 0;
        newTotal = round2(newSubtotal + shippingCost);
      } else {
        newTaxAmount = round2((newSubtotal + shippingCost) * (storedRate / 100));
        newTotal = round2(newSubtotal + shippingCost + newTaxAmount);
      }
    }
  } else if (originalSubtotalAmount && originalSubtotalAmount > 0 && orderData.taxAmount !== undefined) {
    // Legacy order that has a taxAmount but no rate we can trust — fall back
    // to the previous proportional approximation so we don't break old data.
    const ratio = itemTotal / originalSubtotalAmount;
    newSubtotal = itemTotal;
    newTaxAmount = round2(orderData.taxAmount * ratio);
    newTotal = round2(newSubtotal + newTaxAmount + shippingCost);
  } else {
    // No tax data on the order — subtotal + shipping = total.
    newSubtotal = itemTotal;
    newTotal = round2(newSubtotal + shippingCost);
  }

  const updatePayload: any = {
    items: updatedItems,
    totalAmount: newTotal,
    subtotalAmount: newSubtotal,
    originalTotalAmount,
    originalSubtotalAmount,
    updatedAt: Timestamp.now(),
  };
  if (newTaxAmount !== undefined) {
    updatePayload.taxAmount = newTaxAmount;
  }
  if (newTaxBreakdown !== undefined) {
    updatePayload.taxBreakdown = newTaxBreakdown;
  }

  await updateDoc(orderDocRef, updatePayload);

  const updatedSnap = await getDoc(orderDocRef);
  return processOrderTimestamps({ ...updatedSnap.data(), id: updatedSnap.id });
}

/**
 * Full pricing recalculation for an order.
 *
 * Supersedes the old recalculateOrderTax — handles items + discount + shipping
 * + tax in a single atomic update. Uses the tax rate stored on the order
 * (historical rate, preserved across distributor-setting changes) when
 * available; falls back to the distributor's current manualTaxRate for
 * orders that pre-date that field.
 *
 * Discount is applied to the items subtotal BEFORE tax (EU standard) and
 * capped at 100% of items (you can't give away more than the products).
 * Shipping is never discounted.
 */
export async function recalculateOrderPriceAndTax(
  orderId: string,
  actingUser: User,
  opts?: {
    shippingCost?: number;
    discount?: { type: 'fixed' | 'percent'; value: number } | null;
  }
): Promise<Order> {
  if (!actingUser.distributorId) throw new Error("User has no distributorId.");

  const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
  const orderSnap = await getDoc(orderDocRef);

  if (!orderSnap.exists() || orderSnap.data().distributorId !== actingUser.distributorId) {
    throw new Error("Permission Denied or Order not found.");
  }

  const orderData = orderSnap.data() as Order;

  // Fetch distributor tax settings (used as fallback for orders without stored tax fields)
  const distributor = await getDistributorById(actingUser.distributorId);
  if (!distributor) throw new Error("Distributor not found.");

  // Active items in the distributor's tax-behavior convention.
  const activeItems = orderData.items.filter(item => {
    const status = item.itemStatus || 'available';
    return status === 'available' || status === 'back_order';
  });
  const itemTotal = activeItems.reduce((sum, item) => sum + (item.priceAtTimeOfOrder * item.quantity), 0);

  // Discount handling — undefined opts.discount means "keep current", null means "remove"
  let discountType: 'fixed' | 'percent' | undefined;
  let discountValue: number | undefined;
  if (opts?.discount === null) {
    discountType = undefined;
    discountValue = undefined;
  } else if (opts?.discount !== undefined) {
    discountType = opts.discount.type;
    discountValue = opts.discount.value;
  } else {
    discountType = orderData.discountType;
    discountValue = orderData.discountValue;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Cap the discount so it never exceeds itemTotal (no negative products).
  let discountAmount = 0;
  if (discountType && typeof discountValue === 'number' && discountValue > 0) {
    if (discountType === 'fixed') {
      discountAmount = round2(Math.min(discountValue, itemTotal));
    } else {
      const pct = Math.min(100, Math.max(0, discountValue));
      discountAmount = round2(itemTotal * pct / 100);
    }
  }
  const itemAfterDiscount = round2(itemTotal - discountAmount);

  // Shipping: undefined means keep current.
  const enteredShipping = opts?.shippingCost !== undefined
    ? Math.max(0, opts.shippingCost)
    : (orderData.shippingCost || 0);

  // Use order's historical rate + behavior where available; fall back to distributor.
  const hasStoredTax = typeof orderData.taxRate === 'number' && typeof orderData.taxInclusive === 'boolean';
  const rate = hasStoredTax ? orderData.taxRate! : (distributor.manualTaxRate || 0);
  const inclusive = hasStoredTax ? orderData.taxInclusive! : ((distributor.taxBehavior || 'inclusive') === 'inclusive');
  const reverseCharge = orderData.isReverseCharge === true;
  const taxLabel = orderData.taxLabel || distributor.manualTaxLabel || 'VAT';

  // shippingCost + priceAtTimeOfOrder are stored in the same convention
  // (inclusive/exclusive per taxBehavior), so the recalc is idempotent.
  let productsExcl: number;
  let shippingExcl: number;
  let taxAmount: number;
  let totalAmount: number;

  if (rate <= 0 && !reverseCharge) {
    // No tax configured — products and shipping are pass-through.
    productsExcl = itemAfterDiscount;
    shippingExcl = enteredShipping;
    taxAmount = 0;
    totalAmount = round2(itemAfterDiscount + enteredShipping);
  } else if (inclusive) {
    productsExcl = round2(itemAfterDiscount / (1 + rate / 100));
    shippingExcl = round2(enteredShipping / (1 + rate / 100));
    if (reverseCharge) {
      taxAmount = 0;
      totalAmount = round2(productsExcl + shippingExcl);
    } else {
      taxAmount = round2((itemAfterDiscount + enteredShipping) - (productsExcl + shippingExcl));
      totalAmount = round2(itemAfterDiscount + enteredShipping);
    }
  } else {
    productsExcl = itemAfterDiscount;
    shippingExcl = enteredShipping;
    if (reverseCharge) {
      taxAmount = 0;
      totalAmount = round2(productsExcl + shippingExcl);
    } else {
      taxAmount = round2((productsExcl + shippingExcl) * (rate / 100));
      totalAmount = round2(productsExcl + shippingExcl + taxAmount);
    }
  }

  const updatePayload: any = {
    subtotalAmount: productsExcl,
    taxAmount,
    totalAmount,
    taxRate: reverseCharge ? 0 : rate,
    taxInclusive: inclusive,
    taxLabel,
    isReverseCharge: reverseCharge,
    shippingCost: enteredShipping,
    updatedAt: Timestamp.now(),
  };
  if (discountType && discountValue && discountValue > 0) {
    updatePayload.discountType = discountType;
    updatePayload.discountValue = discountValue;
    updatePayload.discountAmount = discountAmount;
  } else {
    // Remove any existing discount fields when discount is cleared.
    updatePayload.discountType = null;
    updatePayload.discountValue = null;
    updatePayload.discountAmount = null;
  }

  await updateDoc(orderDocRef, updatePayload);

  const updatedSnap = await getDoc(orderDocRef);
  return processOrderTimestamps({ ...updatedSnap.data(), id: updatedSnap.id });
}

/** @deprecated Use recalculateOrderPriceAndTax instead. Kept as thin wrapper for legacy callers. */
export async function recalculateOrderTax(
  orderId: string,
  actingUser: User,
  manualShippingCost?: number
): Promise<Order> {
  return recalculateOrderPriceAndTax(orderId, actingUser, {
    shippingCost: manualShippingCost,
  });
}


// ====================================================================
// Fulfillment workflow (soft ownership)
// ====================================================================
// Any operator can claim, take over, pack, ship, and mark-delivered any
// order within their distributor. The assigneeUid signals who is *actively*
// on it; assignmentHistory preserves every handover so the order-detail
// timeline is readable. All helpers below are idempotent — clicking a
// button twice must never produce a dupe side-effect (e.g. two shipping
// emails).

const MAX_ASSIGNMENT_HISTORY = 20;

function appendAssignmentEvent(
  history: OrderAssignmentEvent[] | undefined,
  event: OrderAssignmentEvent
): OrderAssignmentEvent[] {
  const next = [...(history || []), event];
  // Clamp to prevent unbounded growth of the order doc. The oldest entries
  // drop off; the most recent 20 handovers are what matters for daily ops.
  return next.length > MAX_ASSIGNMENT_HISTORY
    ? next.slice(next.length - MAX_ASSIGNMENT_HISTORY)
    : next;
}

/**
 * Claim or take-over an order. Runs as a Firestore transaction so two
 * operators clicking "Claim" simultaneously cannot both become assignee
 * silently — one of them will see a "taken over" event appear in the
 * history. If the caller is already the assignee this is a no-op.
 *
 * When the order is still in `paid` status the claim advances it to
 * `processing` in the same write (the "Claim & start" semantic).
 */
export async function claimOrder(
  orderId: string,
  actingUser: User
): Promise<Order> {
  if (!actingUser.distributorId && actingUser.role !== 'superadmin') {
    throw new Error("User has no distributorId.");
  }
  if (!actingUser.uid || !actingUser.email) {
    throw new Error("User uid and email required to claim an order.");
  }
  const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderDocRef);
    if (!snap.exists()) throw new Error("Order not found.");
    const order = snap.data() as Order;
    // Superadmin may touch any distributor's order (e.g. support action);
    // operators are constrained to their own.
    if (actingUser.role !== 'superadmin' && order.distributorId !== actingUser.distributorId) {
      throw new Error("Permission Denied.");
    }

    const currentAssignee = order.assigneeUid;
    // Idempotent: already mine → nothing to write.
    if (currentAssignee && currentAssignee === actingUser.uid) return;

    const nowIso = new Date().toISOString();
    const isTakeover = !!currentAssignee && currentAssignee !== actingUser.uid;

    // Conditional spread on `fromEmail` — Firestore rejects undefined
    // inside array-nested objects (no `ignoreUndefinedProperties`), and
    // `order.assigneeEmail` may be missing on legacy or externally-written
    // docs where only `assigneeUid` got set. Omitting the key is safer
    // than writing `null`.
    const event: OrderAssignmentEvent = isTakeover
      ? {
          action: 'taken_over',
          byUid: actingUser.uid,
          byEmail: actingUser.email!,
          at: nowIso,
          fromUid: currentAssignee,
          ...(order.assigneeEmail ? { fromEmail: order.assigneeEmail } : {}),
        }
      : {
          action: 'claimed',
          byUid: actingUser.uid,
          byEmail: actingUser.email!,
          at: nowIso,
        };

    const payload: Record<string, any> = {
      assigneeUid: actingUser.uid,
      assigneeEmail: actingUser.email,
      assignedAt: nowIso,
      assignmentHistory: appendAssignmentEvent(order.assignmentHistory, event),
      updatedAt: Timestamp.now(),
    };

    // First claim on a paid order auto-advances to processing. Stock was
    // already moved to 'deducted' at the paid transition, so we do not touch
    // stockState here.
    if (order.status === 'paid' && !isTakeover) {
      payload.status = 'processing';
    }

    tx.update(orderDocRef, payload);
  });

  const finalSnap = await getDoc(orderDocRef);
  return processOrderTimestamps({ ...finalSnap.data(), id: finalSnap.id });
}

/**
 * Move processing → ready_to_ship and record who packed it. Does not touch
 * the stock-state machine (stock was already deducted at `paid`). Idempotent.
 */
export async function markOrderPacked(
  orderId: string,
  actingUser: User
): Promise<Order> {
  if (!actingUser.uid || !actingUser.email) throw new Error("User info missing.");
  if (!actingUser.distributorId && actingUser.role !== 'superadmin') {
    throw new Error("User has no distributorId.");
  }
  const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
  const snap = await getDoc(orderDocRef);
  if (!snap.exists()) throw new Error("Order not found.");
  const order = snap.data() as Order;
  if (actingUser.role !== 'superadmin' && order.distributorId !== actingUser.distributorId) {
    throw new Error("Permission Denied.");
  }

  // Idempotent — no double-write if already in target state.
  if (order.status === 'ready_to_ship') {
    return processOrderTimestamps({ ...order, id: orderId });
  }
  if (order.status !== 'processing' && order.status !== 'paid') {
    throw new Error(`Cannot mark packed from status '${order.status}'.`);
  }

  const nowIso = new Date().toISOString();
  const payload: Record<string, any> = {
    status: 'ready_to_ship',
    packedAt: nowIso,
    packedByUid: actingUser.uid,
    packedByEmail: actingUser.email,
    updatedAt: Timestamp.now(),
  };
  await updateDoc(orderDocRef, payload);

  const final = await getDoc(orderDocRef);
  return processOrderTimestamps({ ...final.data(), id: final.id });
}

/**
 * Move ready_to_ship → shipped (or processing → shipped if someone skipped
 * the packed step), record who shipped it, and fire the customer shipping
 * notification email exactly once on the first transition. Can also be used
 * on an already-shipped order to edit carrier/trackingNumber (in that case
 * status and shippedAt stay untouched, no new email goes out).
 */
export async function markOrderShipped(
  orderId: string,
  actingUser: User,
  shipment: { carrier?: Order['carrier']; trackingNumber?: string; trackingUrl?: string } = {}
): Promise<Order> {
  if (!actingUser.uid || !actingUser.email) throw new Error("User info missing.");
  if (!actingUser.distributorId && actingUser.role !== 'superadmin') {
    throw new Error("User has no distributorId.");
  }
  const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);

  // Transactional so two operators hitting "Mark shipped" in the same
  // split-second both observe the same `oldStatus` and only one of them
  // writes `status = 'shipped'` + triggers the customer email. Outside
  // the tx we read the `didShip` flag and fire the email exactly once.
  const { didShip } = await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderDocRef);
    if (!snap.exists()) throw new Error("Order not found.");
    const order = snap.data() as Order;
    if (actingUser.role !== 'superadmin' && order.distributorId !== actingUser.distributorId) {
      throw new Error("Permission Denied.");
    }

    const alreadyShipped = order.status === 'shipped' || order.status === 'delivered';

    const payload: Record<string, any> = { updatedAt: Timestamp.now() };
    if (shipment.carrier !== undefined) payload.carrier = shipment.carrier;
    if (shipment.trackingNumber !== undefined) payload.trackingNumber = shipment.trackingNumber;
    if (shipment.trackingUrl !== undefined) payload.trackingUrl = shipment.trackingUrl;

    if (!alreadyShipped) {
      if (order.status !== 'processing' && order.status !== 'ready_to_ship') {
        throw new Error(`Cannot mark shipped from status '${order.status}'.`);
      }
      payload.status = 'shipped';
      payload.shippedAt = Timestamp.now();
      payload.shippedByUid = actingUser.uid;
      payload.shippedByEmail = actingUser.email;
    }

    tx.update(orderDocRef, payload);
    return { didShip: !alreadyShipped };
  });

  // Customer email fires once per first-shipped transition. Editing tracking
  // on an already-shipped order never re-emails.
  if (didShip) {
    try {
      const afterSnap = await getDoc(orderDocRef);
      const afterOrder = processOrderTimestamps({ ...afterSnap.data(), id: afterSnap.id });
      const { sendShippingNotification } = await import('./email-service');
      sendShippingNotification(afterOrder).catch(err =>
        logger.error('Failed to send shipping notification', err as Error)
      );
    } catch (error) {
      logger.error('Failed to import email service', error as Error);
    }
  }

  const final = await getDoc(orderDocRef);
  return processOrderTimestamps({ ...final.data(), id: final.id });
}

/**
 * Move shipped → delivered. Phase 1 is manual; phase 2 will wire this to
 * carrier tracking webhooks. Idempotent.
 */
export async function markOrderDelivered(
  orderId: string,
  actingUser: User
): Promise<Order> {
  if (!actingUser.uid || !actingUser.email) throw new Error("User info missing.");
  if (!actingUser.distributorId && actingUser.role !== 'superadmin') {
    throw new Error("User has no distributorId.");
  }
  const orderDocRef = doc(db, ORDERS_COLLECTION, orderId);
  const snap = await getDoc(orderDocRef);
  if (!snap.exists()) throw new Error("Order not found.");
  const order = snap.data() as Order;
  if (actingUser.role !== 'superadmin' && order.distributorId !== actingUser.distributorId) {
    throw new Error("Permission Denied.");
  }

  if (order.status === 'delivered') {
    return processOrderTimestamps({ ...order, id: orderId });
  }
  if (order.status !== 'shipped') {
    throw new Error(`Cannot mark delivered from status '${order.status}'.`);
  }

  const nowIso = new Date().toISOString();
  const payload: Record<string, any> = {
    status: 'delivered',
    deliveredAt: nowIso,
    deliveredByUid: actingUser.uid,
    deliveredByEmail: actingUser.email,
    updatedAt: Timestamp.now(),
  };
  await updateDoc(orderDocRef, payload);

  const final = await getDoc(orderDocRef);
  return processOrderTimestamps({ ...final.data(), id: final.id });
}

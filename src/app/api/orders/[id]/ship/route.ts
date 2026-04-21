import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { requireOrderAccess } from '@/lib/order-access';
import {
  CARRIERS,
  type Carrier,
  buildTrackingUrl,
  validateTrackingNumber,
} from '@/lib/shipping-carriers';
import { sendShippingNotification } from '@/services/email-service';
import type { Order } from '@/types';

// Statuses that can transition to (or stay at) 'shipped' via this endpoint.
// Blocking everything else prevents accidentally "shipping" a cancelled /
// awaiting_payment / on_hold order and emailing the customer a tracking link.
const SHIPPABLE_STATUSES = new Set(['paid', 'processing', 'shipped']);

function hydrateTimestamps<T extends Record<string, any>>(data: T, fields: string[]): T {
  const copy: Record<string, any> = { ...data };
  for (const f of fields) {
    const v = copy[f];
    if (v && typeof v.toDate === 'function') copy[f] = v.toDate().toISOString();
  }
  return copy as T;
}

// Guard window for duplicate submits / double-click: if the same tracking info
// was just set within this many seconds, skip the email but still succeed.
const DUPLICATE_GUARD_SECONDS = 30;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 20, windowMs: 60_000, prefix: 'ship' });
  if (rateLimited) return rateLimited;

  try {
    const { id: orderId } = await params;
    const body = await req.json().catch(() => ({}));
    const {
      carrier,
      trackingNumber,
      trackingUrl: overrideUrl,
      estimatedDeliveryDate,
      sendEmail,
      resendOnly,
    } = body as {
      carrier?: Carrier;
      trackingNumber?: string;
      trackingUrl?: string;
      estimatedDeliveryDate?: string;
      sendEmail?: boolean;
      resendOnly?: boolean;
    };

    const { orderData, orderRef } = await requireOrderAccess(req, orderId);

    // Resend-only path: just fire the email using the already-stored shipping
    // info. Fails if the order was never marked shipped.
    if (resendOnly) {
      if (!orderData.trackingNumber) {
        return NextResponse.json(
          { error: 'This order has no tracking info to resend.' },
          { status: 400 }
        );
      }
      if (!orderData.viewerEmail) {
        return NextResponse.json({ error: 'Order has no customer email.' }, { status: 400 });
      }
      const order = hydrateTimestamps(orderData, [
        'createdAt', 'updatedAt', 'paidAt', 'approvedAt', 'shippedAt',
        'paymentLinkCreatedAt', 'paymentLinkExpiresAt', 'lastPaymentReminderAt',
      ]) as Order;
      await sendShippingNotification(order);
      return NextResponse.json({ success: true, action: 'resent' });
    }

    // Validate inputs for the full ship / update path.
    if (!carrier || !CARRIERS.includes(carrier)) {
      return NextResponse.json({ error: 'Carrier is required.' }, { status: 400 });
    }
    if (!trackingNumber || !trackingNumber.trim()) {
      return NextResponse.json({ error: 'Tracking number is required.' }, { status: 400 });
    }
    const validation = validateTrackingNumber(carrier, trackingNumber);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.warning || 'Invalid tracking number.' }, { status: 400 });
    }

    // Status gate — prevents shipping cancelled / awaiting_payment / on_hold
    // orders via this endpoint (which would silently move them to 'shipped'
    // and email the customer).
    if (!SHIPPABLE_STATUSES.has(orderData.status)) {
      return NextResponse.json(
        { error: `Cannot ship an order in '${orderData.status}' state.` },
        { status: 400 }
      );
    }

    // Validate the optional trackingUrl override. The stored URL ends up as
    // an <a href> on the public tracking page — letting a client pass
    // arbitrary schemes would be an open redirect / phishing vector. Only
    // plain http(s) is allowed. Only honor the override for 'other' carrier
    // (for the known carriers we trust the built URL).
    let overrideUrlSafe: string | undefined;
    if (overrideUrl && overrideUrl.trim()) {
      const trimmed = overrideUrl.trim().slice(0, 500);
      if (!/^https?:\/\//i.test(trimmed)) {
        return NextResponse.json(
          { error: 'Tracking URL must start with http:// or https://.' },
          { status: 400 }
        );
      }
      if (carrier === 'other') overrideUrlSafe = trimmed;
      // For known carriers we ignore the override and use the template-built URL.
    }

    // Validate optional estimated delivery date. Accept an ISO date (or
    // datetime) string; reject anything else so we don't store garbage
    // that renders as "Invalid Date" on the tracking page.
    let estimatedDeliveryIso: string | undefined;
    if (estimatedDeliveryDate) {
      const parsed = new Date(estimatedDeliveryDate);
      if (isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: 'Estimated delivery date is not a valid date.' },
          { status: 400 }
        );
      }
      estimatedDeliveryIso = parsed.toISOString();
    }

    const normalizedNumber = trackingNumber.trim().slice(0, 100);
    const finalTrackingUrl =
      overrideUrlSafe ||
      buildTrackingUrl(carrier, normalizedNumber) ||
      undefined;

    // Detect "no-op" edit: same carrier, same number, same URL, same ETA.
    // We still accept the request, but skip firing the email a second time.
    const existingEtaIso = orderData.estimatedDeliveryDate
      ? (typeof (orderData.estimatedDeliveryDate as any).toDate === 'function'
          ? (orderData.estimatedDeliveryDate as any).toDate().toISOString()
          : new Date(orderData.estimatedDeliveryDate).toISOString())
      : null;
    const isNoOp =
      orderData.carrier === carrier &&
      orderData.trackingNumber === normalizedNumber &&
      orderData.trackingUrl === finalTrackingUrl &&
      existingEtaIso === (estimatedDeliveryIso || null);

    const wasAlreadyShipped = orderData.status === 'shipped' || !!orderData.shippedAt;
    const recentlyShipped =
      wasAlreadyShipped &&
      orderData.shippedAt &&
      typeof (orderData.shippedAt as any).toDate === 'function' &&
      ((Date.now() - (orderData.shippedAt as any).toDate().getTime()) / 1000) < DUPLICATE_GUARD_SECONDS;

    const update: any = {
      carrier,
      trackingNumber: normalizedNumber,
      trackingUrl: finalTrackingUrl,
      // Use FieldValue.delete() when the distributor cleared the ETA on an
      // edit — otherwise Firestore would preserve the old value (undefined
      // is a no-op).
      estimatedDeliveryDate: estimatedDeliveryIso ?? FieldValue.delete(),
      updatedAt: Timestamp.now(),
    };
    if (!wasAlreadyShipped) {
      update.status = 'shipped';
      update.shippedAt = Timestamp.now();
    }

    await orderRef.update(update);
    console.log(
      `[ship] order=${orderId} carrier=${carrier} status=${wasAlreadyShipped ? 'updated' : 'shipped'} ` +
      `emailed=${sendEmail !== false && !!orderData.viewerEmail && !isNoOp && !recentlyShipped}`
    );

    // Email: send on first-time shipping by default. On edit, only send if
    // explicitly requested (distributor's checkbox). Guard against double
    // click / duplicate submit.
    const shouldSendEmail =
      sendEmail !== false &&
      orderData.viewerEmail &&
      !isNoOp &&
      !recentlyShipped;

    if (shouldSendEmail) {
      const merged = { ...orderData, ...update };
      const order = hydrateTimestamps(merged, [
        'createdAt', 'updatedAt', 'paidAt', 'approvedAt', 'shippedAt',
        'paymentLinkCreatedAt', 'paymentLinkExpiresAt', 'lastPaymentReminderAt',
      ]) as Order;
      // Fire-and-forget: don't block the response on email delivery.
      sendShippingNotification(order).catch(err =>
        console.error('[ship] Failed to send shipping notification:', err)
      );
    }

    return NextResponse.json({
      success: true,
      action: wasAlreadyShipped ? 'updated' : 'shipped',
      emailed: shouldSendEmail,
    });
  } catch (error: any) {
    if (error?.status) return authErrorResponse(error);
    console.error('Error in ship route:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update shipping info.' }, { status: 500 });
  }
}

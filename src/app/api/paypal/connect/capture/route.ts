import { captureOrder } from '@/lib/paypal';
import { NextRequest, NextResponse } from 'next/server';
import { createOrderFromPayPal } from '@/services/server-order-service';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * Capture a PayPal order after customer approval
 * This is called when the customer returns from PayPal after approving payment
 */
export async function POST(req: NextRequest) {
  try {
    const { paypalOrderId, pendingOrderId } = await req.json();

    if (!paypalOrderId || !pendingOrderId) {
      return NextResponse.json(
        { error: 'PayPal order ID and pending order ID are required.' },
        { status: 400 }
      );
    }

    // Verify the pending order exists and matches
    const adminDb = getAdminDb();
    if (!adminDb) {
      throw new Error('Admin DB not initialized');
    }

    const pendingOrderRef = adminDb.collection('pendingOrders').doc(pendingOrderId);
    const pendingOrderSnap = await pendingOrderRef.get();

    if (!pendingOrderSnap.exists) {
      return NextResponse.json(
        { error: 'Pending order not found. It may have already been processed.' },
        { status: 404 }
      );
    }

    const pendingData = pendingOrderSnap.data();

    // Verify the PayPal order ID matches
    if (pendingData?.paypalOrderId !== paypalOrderId) {
      console.warn(
        `PayPal order ID mismatch: expected ${pendingData?.paypalOrderId}, got ${paypalOrderId}`
      );
      return NextResponse.json(
        { error: 'PayPal order ID mismatch.' },
        { status: 400 }
      );
    }

    // Capture the PayPal payment
    const captureResult = await captureOrder(paypalOrderId);

    if (captureResult.status !== 'COMPLETED') {
      console.error('PayPal capture failed:', captureResult);
      return NextResponse.json(
        { error: `Payment capture failed. Status: ${captureResult.status}` },
        { status: 400 }
      );
    }

    // Create the final order
    const order = await createOrderFromPayPal({
      pendingOrderId,
      paypalOrderId,
      paypalCaptureId: captureResult.captureId,
      payerEmail: captureResult.payerEmail,
      payerName: captureResult.payerName,
    });

    console.log(`PayPal payment captured and order ${order.id} created successfully`);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  } catch (error: any) {
    console.error('PayPal capture error:', error);
    return NextResponse.json(
      { error: `Failed to capture payment: ${error.message}` },
      { status: 500 }
    );
  }
}

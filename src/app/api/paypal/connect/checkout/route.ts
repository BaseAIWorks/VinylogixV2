import { createOrder } from '@/lib/paypal';
import { NextRequest, NextResponse } from 'next/server';
import { getDistributorById } from '@/services/server-distributor-service';
import { getAdminDb } from '@/lib/firebase-admin';
import type { CartItem, VinylRecord } from '@/types';

// Server-side function to fetch a record by ID using Admin SDK
async function getRecordFromDb(recordId: string): Promise<VinylRecord | null> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error('Admin DB not initialized');
  }

  try {
    const docSnap = await adminDb.collection('vinylRecords').doc(recordId).get();
    if (docSnap.exists) {
      return { ...docSnap.data(), id: docSnap.id } as VinylRecord;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching record ${recordId}:`, error);
    return null;
  }
}

// Validated cart item with DB-verified data
interface ValidatedCartItem {
  dbRecord: VinylRecord;
  quantity: number;
}

export async function POST(req: NextRequest) {
  try {
    const { distributorId, items, customerEmail, viewerId, shippingAddress, billingAddress, customerName, phoneNumber } = await req.json();

    if (!distributorId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Distributor ID and items are required.' },
        { status: 400 }
      );
    }

    if (!viewerId || !customerEmail) {
      return NextResponse.json(
        { error: 'Customer information is required.' },
        { status: 400 }
      );
    }

    // Get distributor to verify PayPal account
    const distributor = await getDistributorById(distributorId);

    if (!distributor) {
      return NextResponse.json(
        { error: 'Distributor not found.' },
        { status: 404 }
      );
    }

    if (!distributor.paypalMerchantId) {
      return NextResponse.json(
        { error: 'This distributor has not connected their PayPal account yet.' },
        { status: 400 }
      );
    }

    if (distributor.paypalAccountStatus !== 'verified') {
      return NextResponse.json(
        { error: 'This distributor\'s PayPal account is not fully verified yet.' },
        { status: 400 }
      );
    }

    // SECURITY: Fetch all records from the database to validate prices
    // Never trust client-supplied prices
    const validatedItems: ValidatedCartItem[] = [];

    for (const item of items as CartItem[]) {
      const recordId = item.record?.id;

      if (!recordId) {
        return NextResponse.json(
          { error: 'Invalid cart item: missing record ID.' },
          { status: 400 }
        );
      }

      // Fetch the actual record from the database
      const dbRecord = await getRecordFromDb(recordId);

      if (!dbRecord) {
        return NextResponse.json(
          { error: `Record not found: "${item.record?.title || recordId}". It may have been removed.` },
          { status: 404 }
        );
      }

      // Verify the record belongs to the claimed distributor
      if (dbRecord.distributorId !== distributorId) {
        console.warn(
          `Security: Cart item ${recordId} belongs to distributor ${dbRecord.distributorId}, ` +
          `but checkout was attempted for distributor ${distributorId}`
        );
        return NextResponse.json(
          { error: `Record "${dbRecord.title}" is not available from this distributor.` },
          { status: 400 }
        );
      }

      // Verify the record is for sale (inventory item)
      if (!dbRecord.isInventoryItem || dbRecord.isForSale === false) {
        return NextResponse.json(
          { error: `Record "${dbRecord.title}" is not available for purchase.` },
          { status: 400 }
        );
      }

      // Validate quantity is reasonable
      if (!item.quantity || item.quantity < 1 || item.quantity > 100) {
        return NextResponse.json(
          { error: `Invalid quantity for "${dbRecord.title}".` },
          { status: 400 }
        );
      }

      // Use the database price, not the client-supplied price
      if (!dbRecord.sellingPrice || dbRecord.sellingPrice <= 0) {
        return NextResponse.json(
          { error: `Record "${dbRecord.title}" does not have a valid selling price.` },
          { status: 400 }
        );
      }

      validatedItems.push({
        dbRecord,
        quantity: item.quantity,
      });
    }

    // Calculate total amount using database prices (in cents)
    const totalAmountCents = validatedItems.reduce((sum: number, item) => {
      return sum + Math.round((item.dbRecord.sellingPrice as number) * 100) * item.quantity;
    }, 0);

    // Calculate 4% platform fee (in cents)
    const platformFeeAmount = Math.round(totalAmountCents * 0.04);

    // Generate a temporary order ID for reference
    const tempOrderId = `TEMP-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Store pending order data in Firestore for later retrieval
    const adminDb = getAdminDb();
    if (!adminDb) {
      throw new Error('Admin DB not initialized');
    }

    // Store pending order info (will be converted to real order after payment)
    const pendingOrderData = {
      distributorId,
      viewerId,
      viewerEmail: customerEmail,
      customerName: customerName || '',
      shippingAddress: shippingAddress || '',
      billingAddress: billingAddress || shippingAddress || '',
      phoneNumber: phoneNumber || '',
      items: validatedItems.map(item => ({
        recordId: item.dbRecord.id,
        title: item.dbRecord.title,
        artist: item.dbRecord.artist,
        cover_url: item.dbRecord.cover_url,
        priceAtTimeOfOrder: item.dbRecord.sellingPrice,
        quantity: item.quantity,
      })),
      totalAmount: totalAmountCents / 100, // Store in euros
      platformFeeAmount,
      paymentMethod: 'paypal',
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection('pendingOrders').doc(tempOrderId).set(pendingOrderData);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    // Build PayPal order items
    const paypalItems = validatedItems.map((item) => ({
      name: `${item.dbRecord.artist} - ${item.dbRecord.title}`,
      description: item.dbRecord.formatDetails || 'Vinyl Record',
      quantity: item.quantity,
      unitPrice: Math.round((item.dbRecord.sellingPrice as number) * 100), // in cents
    }));

    // Create PayPal order with marketplace split
    // Note: PayPal will append 'token' (the order ID) to the return URL automatically
    const { paypalOrderId, approvalUrl } = await createOrder({
      items: paypalItems,
      totalAmount: totalAmountCents,
      platformFeeAmount,
      merchantId: distributor.paypalMerchantId,
      orderId: tempOrderId,
      returnUrl: `${siteUrl}/checkout/paypal/success?orderId=${tempOrderId}`,
      cancelUrl: `${siteUrl}/checkout?cancelled=true`,
    });

    // Update pending order with PayPal order ID
    await adminDb.collection('pendingOrders').doc(tempOrderId).update({
      paypalOrderId,
    });

    console.log(`PayPal order ${paypalOrderId} created for pending order ${tempOrderId}`);

    return NextResponse.json({
      paypalOrderId,
      approvalUrl,
      tempOrderId,
    });
  } catch (error: any) {
    console.error('PayPal Connect Checkout Error:', error);
    return NextResponse.json(
      { error: `Checkout failed: ${error.message}` },
      { status: 500 }
    );
  }
}

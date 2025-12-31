import { stripe } from '@/lib/stripe';
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
    const { distributorId, items, customerEmail } = await req.json();

    if (!distributorId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Distributor ID and items are required.' },
        { status: 400 }
      );
    }

    // Get distributor to verify Stripe account
    const distributor = await getDistributorById(distributorId);

    if (!distributor) {
      return NextResponse.json(
        { error: 'Distributor not found.' },
        { status: 404 }
      );
    }

    if (!distributor.stripeAccountId) {
      return NextResponse.json(
        { error: 'This distributor has not connected their Stripe account yet.' },
        { status: 400 }
      );
    }

    if (distributor.stripeAccountStatus !== 'verified') {
      return NextResponse.json(
        { error: 'This distributor\'s Stripe account is not fully verified yet.' },
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

    // Build line items using ONLY database values
    const lineItems = validatedItems.map((item) => ({
      price_data: {
        currency: 'eur',
        product_data: {
          name: `${item.dbRecord.artist} - ${item.dbRecord.title}`,
          description: item.dbRecord.formatDetails || 'Vinyl Record',
          images: item.dbRecord.cover_url ? [item.dbRecord.cover_url] : [],
        },
        // SECURITY: Use the price from the database, never from client
        // We've already validated sellingPrice exists and is > 0 above
        unit_amount: Math.round((item.dbRecord.sellingPrice as number) * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    // Calculate total amount using database prices
    // We've already validated all sellingPrice values exist and are > 0 above
    const totalAmount = validatedItems.reduce((sum: number, item) => {
      return sum + (item.dbRecord.sellingPrice as number) * item.quantity;
    }, 0);

    // Calculate 4% platform fee (in cents)
    const platformFeeAmount = Math.round(totalAmount * 100 * 0.04);

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    // Create Stripe Checkout Session with Connect
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      customer_email: customerEmail,
      success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout?cancelled=true`,
      payment_intent_data: {
        application_fee_amount: platformFeeAmount,
        transfer_data: {
          destination: distributor.stripeAccountId,
        },
      },
      metadata: {
        distributorId,
        platformFeeAmount: platformFeeAmount.toString(),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe Connect Checkout Error:', error);
    return NextResponse.json(
      { error: `Checkout failed: ${error.message}` },
      { status: 500 }
    );
  }
}

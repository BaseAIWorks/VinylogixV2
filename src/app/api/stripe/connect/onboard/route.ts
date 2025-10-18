
import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { updateDistributor } from '@/services/distributor-service'; // We need this to save the Stripe Account ID

export async function POST(req: NextRequest) {
  try {
    const { distributorId, distributorEmail } = await req.json();

    if (!distributorId) {
      return NextResponse.json({ error: 'Distributor ID is required.' }, { status: 400 });
    }

    // Optional: Verify the request is coming from an authenticated user.
    // This is more complex without Server Actions but can be done by validating a token.
    // For now, we rely on the client only calling this for the logged-in master user.

    let accountId = (await updateDistributor(distributorId, {}, { email: 'server-action' } as any))?.stripeAccountId;

    // 1. Create a Stripe account if one doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email: distributorEmail,
        business_type: 'individual', // or 'company'
      });
      accountId = account.id;

      // Save the new account ID to the distributor's document in Firestore
      await updateDistributor(distributorId, { stripeAccountId: accountId, stripeAccountStatus: 'pending' }, { email: 'server-action' } as any);
    }

    // 2. Create an account link for the onboarding flow
    const returnUrl = `${req.nextUrl.origin}/settings?stripe_onboard=success`;
    const refreshUrl = `${req.nextUrl.origin}/settings?stripe_onboard=refresh`;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    // 3. Return the URL to the client to redirect
    return NextResponse.json({ url: accountLink.url });

  } catch (error: any) {
    console.error("Stripe Connect Onboarding Error:", error);
    return NextResponse.json({ error: `Stripe Connect onboarding failed: ${error.message}` }, { status: 500 });
  }
}

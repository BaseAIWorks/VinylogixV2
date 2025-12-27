
import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { updateDistributor, getDistributorById } from '@/services/server-distributor-service';

export async function POST(req: NextRequest) {
  try {
    const { distributorId, distributorEmail } = await req.json();

    if (!distributorId) {
      return NextResponse.json({ error: 'Distributor ID is required.' }, { status: 400 });
    }

    // In a real app, you would verify the user's identity (e.g., from an auth token)
    // and ensure they are the master user for this distributorId.

    const distributor = await getDistributorById(distributorId);
    let accountId = distributor?.stripeAccountId;

    // 1. Create a Stripe account if one doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'standard',
        email: distributorEmail,
        metadata: {
            distributorId: distributorId,
        }
      });
      accountId = account.id;

      // Save the new account ID to the distributor's document in Firestore
      await updateDistributor(distributorId, { stripeAccountId: accountId, stripeAccountStatus: 'pending' });
    }
    
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    // 2. Create an account link for the onboarding flow
    const returnUrl = `${siteUrl}/settings?stripe_onboard=success`;
    const refreshUrl = `${siteUrl}/settings?stripe_onboard=refresh`;

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

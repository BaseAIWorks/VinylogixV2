
import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { updateDistributor, getDistributorById } from '@/services/server-distributor-service';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // 1. Verify the Firebase ID token from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in and try again.' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();

    if (!adminAuth) {
      console.error('Firebase Admin Auth not initialized');
      return NextResponse.json(
        { error: 'Authentication service unavailable.' },
        { status: 500 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
      return NextResponse.json(
        { error: 'Invalid or expired authentication token. Please log in again.' },
        { status: 401 }
      );
    }

    // 2. Extract user claims and verify permissions
    // Check claims first, but fall back to Firestore if claims aren't synced yet
    let userRole = decodedToken.role;
    let userDistributorId = decodedToken.distributorId;

    // If claims are missing, fetch from Firestore as fallback
    if (!userRole) {
      const adminDb = (await import('@/lib/firebase-admin')).getAdminDb();
      if (adminDb) {
        const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userRole = userData?.role;
          userDistributorId = userData?.distributorId;
        }
      }
    }

    if (userRole !== 'master' && userRole !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only master users can connect Stripe accounts.' },
        { status: 403 }
      );
    }

    const { distributorId, distributorEmail } = await req.json();

    if (!distributorId) {
      return NextResponse.json({ error: 'Distributor ID is required.' }, { status: 400 });
    }

    // 3. Verify the user is the master of this specific distributor (unless superadmin)
    if (userRole !== 'superadmin' && userDistributorId !== distributorId) {
      console.warn(
        `User ${decodedToken.uid} attempted to connect Stripe for distributor ${distributorId} but belongs to ${userDistributorId}`
      );
      return NextResponse.json(
        { error: 'You can only connect Stripe for your own distributor account.' },
        { status: 403 }
      );
    }

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

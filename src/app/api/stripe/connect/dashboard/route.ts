import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getDistributorById } from '@/services/server-distributor-service';
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
        { error: 'Only master users can access Stripe dashboard.' },
        { status: 403 }
      );
    }

    const { distributorId } = await req.json();

    if (!distributorId) {
      return NextResponse.json({ error: 'Distributor ID is required.' }, { status: 400 });
    }

    // 3. Verify the user is the master of this specific distributor (unless superadmin)
    if (userRole !== 'superadmin' && userDistributorId !== distributorId) {
      return NextResponse.json(
        { error: 'You can only access Stripe dashboard for your own distributor account.' },
        { status: 403 }
      );
    }

    const distributor = await getDistributorById(distributorId);

    if (!distributor?.stripeAccountId) {
      return NextResponse.json(
        { error: 'No Stripe account connected. Please complete onboarding first.' },
        { status: 400 }
      );
    }

    // Retrieve the account to check its type
    const account = await stripe.accounts.retrieve(distributor.stripeAccountId);

    // Standard accounts manage their dashboard directly at dashboard.stripe.com
    // Express accounts use a login link
    if (account.type === 'standard') {
      // Standard accounts go directly to Stripe Dashboard
      return NextResponse.json({ url: 'https://dashboard.stripe.com' });
    } else {
      // Express/Custom accounts use a login link
      const loginLink = await stripe.accounts.createLoginLink(distributor.stripeAccountId);
      return NextResponse.json({ url: loginLink.url });
    }

  } catch (error: any) {
    console.error("Stripe Dashboard Link Error:", error);

    return NextResponse.json(
      { error: `Failed to access Stripe dashboard: ${error.message}` },
      { status: 500 }
    );
  }
}

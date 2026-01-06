import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { getDistributorById, updateDistributor } from '@/services/server-distributor-service';
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
        { error: 'Only master users can refresh Stripe status.' },
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
        { error: 'You can only refresh Stripe status for your own distributor account.' },
        { status: 403 }
      );
    }

    const distributor = await getDistributorById(distributorId);

    if (!distributor?.stripeAccountId) {
      return NextResponse.json(
        { error: 'No Stripe account connected.' },
        { status: 400 }
      );
    }

    // Fetch the current account status from Stripe
    const account = await stripe.accounts.retrieve(distributor.stripeAccountId);

    // Determine status based on account fields (same logic as webhook)
    let status: 'pending' | 'verified' | 'in_review' | 'restricted' | 'details_needed' = 'pending';

    const requirements = account.requirements;
    const hasPendingVerification = requirements?.pending_verification && requirements.pending_verification.length > 0;
    const hasCurrentlyDue = requirements?.currently_due && requirements.currently_due.length > 0;
    const hasPastDue = requirements?.past_due && requirements.past_due.length > 0;
    const hasDisabledReason = requirements?.disabled_reason;

    if (account.charges_enabled && account.payouts_enabled) {
      status = 'verified';
    } else if (hasDisabledReason) {
      status = 'restricted';
    } else if (hasCurrentlyDue || hasPastDue) {
      status = 'details_needed';
    } else if (account.details_submitted && hasPendingVerification) {
      status = 'in_review';
    } else if (account.details_submitted) {
      status = 'in_review';
    }

    // Update Firestore with the fresh status
    await updateDistributor(distributorId, {
      stripeAccountStatus: status,
    });

    console.log(
      `Manually refreshed Stripe Connect status for distributor ${distributorId} to ${status}`,
      {
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        pending_verification: requirements?.pending_verification,
        currently_due: requirements?.currently_due,
        disabled_reason: requirements?.disabled_reason,
      }
    );

    return NextResponse.json({
      status,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });

  } catch (error: any) {
    console.error("Stripe Status Refresh Error:", error);
    return NextResponse.json(
      { error: `Failed to refresh Stripe status: ${error.message}` },
      { status: 500 }
    );
  }
}

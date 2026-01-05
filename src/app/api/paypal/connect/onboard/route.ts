import { createPartnerReferral } from '@/lib/paypal';
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
    const userRole = decodedToken.role;
    const userDistributorId = decodedToken.distributorId;

    if (userRole !== 'master' && userRole !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only master users can connect PayPal accounts.' },
        { status: 403 }
      );
    }

    const { distributorId, distributorEmail } = await req.json();

    if (!distributorId) {
      return NextResponse.json({ error: 'Distributor ID is required.' }, { status: 400 });
    }

    if (!distributorEmail) {
      return NextResponse.json({ error: 'Distributor email is required.' }, { status: 400 });
    }

    // 3. Verify the user is the master of this specific distributor (unless superadmin)
    if (userRole !== 'superadmin' && userDistributorId !== distributorId) {
      console.warn(
        `User ${decodedToken.uid} attempted to connect PayPal for distributor ${distributorId} but belongs to ${userDistributorId}`
      );
      return NextResponse.json(
        { error: 'You can only connect PayPal for your own distributor account.' },
        { status: 403 }
      );
    }

    const distributor = await getDistributorById(distributorId);

    // Check if already connected
    if (distributor?.paypalMerchantId && distributor.paypalAccountStatus === 'verified') {
      return NextResponse.json(
        { error: 'PayPal account already connected. Please disconnect first to connect a new account.' },
        { status: 400 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';
    const returnUrl = `${siteUrl}/settings?paypal_onboard=success`;

    // Create partner referral link for PayPal Commerce Platform
    const { actionUrl, partnerReferralId } = await createPartnerReferral({
      distributorId,
      distributorEmail,
      returnUrl,
    });

    // Update distributor with pending status
    await updateDistributor(distributorId, {
      paypalEmail: distributorEmail,
      paypalAccountStatus: 'pending',
    });

    console.log(`PayPal onboarding initiated for distributor ${distributorId}, referral: ${partnerReferralId}`);

    // Return the URL to the client to redirect
    return NextResponse.json({ url: actionUrl });

  } catch (error: any) {
    console.error("PayPal Connect Onboarding Error:", error);
    return NextResponse.json(
      { error: `PayPal Connect onboarding failed: ${error.message}` },
      { status: 500 }
    );
  }
}

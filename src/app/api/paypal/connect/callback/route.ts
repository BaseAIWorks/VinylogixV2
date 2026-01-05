import { getMerchantStatus } from '@/lib/paypal';
import { NextRequest, NextResponse } from 'next/server';
import { updateDistributor, getDistributorById } from '@/services/server-distributor-service';
import { getAdminAuth } from '@/lib/firebase-admin';

/**
 * This route is called when we need to verify and store the merchant ID
 * after a distributor completes PayPal onboarding.
 *
 * PayPal returns the merchant ID as a query parameter when redirecting back.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Verify the Firebase ID token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401 }
      );
    }

    const idToken = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();

    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Authentication service unavailable.' },
        { status: 500 }
      );
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: 'Invalid authentication token.' },
        { status: 401 }
      );
    }

    const userRole = decodedToken.role;
    const userDistributorId = decodedToken.distributorId;

    if (userRole !== 'master' && userRole !== 'superadmin') {
      return NextResponse.json(
        { error: 'Only master users can complete PayPal setup.' },
        { status: 403 }
      );
    }

    const { distributorId, merchantIdInPayPal } = await req.json();

    if (!distributorId || !merchantIdInPayPal) {
      return NextResponse.json(
        { error: 'Distributor ID and merchant ID are required.' },
        { status: 400 }
      );
    }

    // Verify the user has permission for this distributor
    if (userRole !== 'superadmin' && userDistributorId !== distributorId) {
      return NextResponse.json(
        { error: 'You can only complete PayPal setup for your own distributor.' },
        { status: 403 }
      );
    }

    // Verify the merchant status with PayPal
    let merchantStatus;
    try {
      merchantStatus = await getMerchantStatus(merchantIdInPayPal);
    } catch (error: any) {
      console.error('Failed to verify PayPal merchant status:', error);
      // If we can't verify, still save but mark as pending
      await updateDistributor(distributorId, {
        paypalMerchantId: merchantIdInPayPal,
        paypalAccountStatus: 'pending',
      });

      return NextResponse.json({
        success: true,
        status: 'pending',
        message: 'PayPal account linked. Verification pending.',
      });
    }

    // Determine account status
    const isVerified = merchantStatus.paymentsReceivable && merchantStatus.primaryEmailConfirmed;
    const accountStatus = isVerified ? 'verified' : 'pending';

    // Update distributor with merchant ID and status
    await updateDistributor(distributorId, {
      paypalMerchantId: merchantIdInPayPal,
      paypalAccountStatus: accountStatus,
    });

    console.log(`PayPal merchant ${merchantIdInPayPal} linked to distributor ${distributorId}, status: ${accountStatus}`);

    return NextResponse.json({
      success: true,
      status: accountStatus,
      paymentsReceivable: merchantStatus.paymentsReceivable,
      emailConfirmed: merchantStatus.primaryEmailConfirmed,
    });

  } catch (error: any) {
    console.error('PayPal callback error:', error);
    return NextResponse.json(
      { error: `Failed to complete PayPal setup: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check current PayPal status for a distributor
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const adminAuth = getAdminAuth();

    if (!adminAuth) {
      return NextResponse.json({ error: 'Authentication service unavailable.' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: 'Invalid authentication token.' }, { status: 401 });
    }

    const distributorId = req.nextUrl.searchParams.get('distributorId');
    if (!distributorId) {
      return NextResponse.json({ error: 'Distributor ID required.' }, { status: 400 });
    }

    // Verify permission
    if (decodedToken.role !== 'superadmin' && decodedToken.distributorId !== distributorId) {
      return NextResponse.json({ error: 'Access denied.' }, { status: 403 });
    }

    const distributor = await getDistributorById(distributorId);

    if (!distributor?.paypalMerchantId) {
      return NextResponse.json({
        connected: false,
        status: null,
      });
    }

    // Optionally re-verify with PayPal
    let liveStatus = null;
    try {
      liveStatus = await getMerchantStatus(distributor.paypalMerchantId);

      // Update status if changed
      const isVerified = liveStatus.paymentsReceivable && liveStatus.primaryEmailConfirmed;
      const newStatus = isVerified ? 'verified' : distributor.paypalAccountStatus;

      if (newStatus !== distributor.paypalAccountStatus) {
        await updateDistributor(distributorId, { paypalAccountStatus: newStatus });
      }
    } catch {
      // Use cached status if PayPal API fails
    }

    return NextResponse.json({
      connected: true,
      merchantId: distributor.paypalMerchantId,
      email: distributor.paypalEmail,
      status: distributor.paypalAccountStatus,
      paymentsReceivable: liveStatus?.paymentsReceivable,
      emailConfirmed: liveStatus?.primaryEmailConfirmed,
    });

  } catch (error: any) {
    console.error('PayPal status check error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

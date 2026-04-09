import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth, authErrorResponse } from '@/lib/auth-helpers';
import { FieldValue } from 'firebase-admin/firestore';
import { sendAccessApprovedEmail, sendAccessDeniedEmail } from '@/services/email-service';

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (error) {
    return authErrorResponse(error);
  }

  const body = await req.json();
  const { notificationId, action } = body as {
    notificationId: string;
    action: 'approve' | 'deny';
  };

  if (!notificationId || !['approve', 'deny'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const adminDb = getAdminDb();
  if (!adminDb) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  // Fetch the notification
  const notifDoc = await adminDb.collection('notifications').doc(notificationId).get();
  if (!notifDoc.exists) {
    return NextResponse.json({ error: 'Request not found.' }, { status: 404 });
  }

  const notifData = notifDoc.data()!;
  if (notifData.type !== 'access_request' || notifData.requestStatus !== 'pending') {
    return NextResponse.json({ error: 'Request already processed.' }, { status: 400 });
  }

  // Verify the caller is a master/operator of this distributor or superadmin
  const userDoc = await adminDb.collection('users').doc(auth.uid).get();
  const userData = userDoc.data();
  const isOperatorOfDistributor = userData?.distributorId === notifData.distributorId;
  const isSuperAdmin = userData?.role === 'superadmin';
  // Also check if user is the masterUserUid on the distributor document
  let isMasterOfDistributor = false;
  if (!isOperatorOfDistributor && !isSuperAdmin) {
    const distDoc = await adminDb.collection('distributors').doc(notifData.distributorId).get();
    isMasterOfDistributor = distDoc.exists && distDoc.data()?.masterUserUid === auth.uid;
  }
  if (!userData || (!isSuperAdmin && !isOperatorOfDistributor && !isMasterOfDistributor)) {
    return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
  }

  const distributorId = notifData.distributorId;
  const requesterEmail = notifData.requesterEmail;
  const requesterUid = notifData.requesterUid;

  // Get distributor info for email
  const distDoc = await adminDb.collection('distributors').doc(distributorId).get();
  const distData = distDoc.data();
  const distributorName = distData?.companyName || distData?.name || 'Distributor';
  const storefrontSlug = distData?.slug;

  if (action === 'approve') {
    // Grant access to the requester + set origin if not already set
    const requesterDoc = await adminDb.collection('users').doc(requesterUid).get();
    const requesterData = requesterDoc.data();
    await adminDb.collection('users').doc(requesterUid).update({
      accessibleDistributorIds: FieldValue.arrayUnion(distributorId),
      ...(!requesterData?.originType ? {
        originType: 'access_request',
        originDistributorId: distributorId,
        originDistributorName: distributorName,
      } : {}),
    });

    // Send approved email
    if (requesterEmail) {
      await sendAccessApprovedEmail(requesterEmail, distributorName, storefrontSlug);
    }
  } else {
    // Send denied email
    if (requesterEmail) {
      await sendAccessDeniedEmail(requesterEmail, distributorName);
    }
  }

  // Update notification status
  await adminDb.collection('notifications').doc(notificationId).update({
    requestStatus: action === 'approve' ? 'approved' : 'denied',
    isRead: true,
  });

  return NextResponse.json({ success: true });
}

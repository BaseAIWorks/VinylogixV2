import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth, authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { resolveDistributorBySlug } from '@/lib/storefront-helpers';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 5, windowMs: 60_000, prefix: 'request-access' });
  if (rateLimited) return rateLimited;

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (error) {
    return authErrorResponse(error);
  }

  const { slug } = await params;
  const result = await resolveDistributorBySlug(slug);
  if (!result) {
    return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 });
  }

  const { id: distributorId, data: distData } = result;
  const adminDb = getAdminDb()!;

  // Check if user already has access
  const userDoc = await adminDb.collection('users').doc(auth.uid).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const userData = userDoc.data()!;

  // Already an operator of this distributor
  if (userData.distributorId === distributorId) {
    return NextResponse.json({ error: 'You already have access.' }, { status: 400 });
  }

  // Already an approved client
  if (Array.isArray(userData.accessibleDistributorIds) &&
      userData.accessibleDistributorIds.includes(distributorId)) {
    return NextResponse.json({ error: 'You already have access.' }, { status: 400 });
  }

  // Check for existing pending request
  const existingRequest = await adminDb
    .collection('notifications')
    .where('distributorId', '==', distributorId)
    .where('type', '==', 'access_request')
    .where('requesterUid', '==', auth.uid)
    .where('requestStatus', '==', 'pending')
    .limit(1)
    .get();

  if (!existingRequest.empty) {
    return NextResponse.json({ error: 'You already have a pending request.' }, { status: 409 });
  }

  // Create access request notification for the distributor
  const requesterName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || undefined;

  await adminDb.collection('notifications').add({
    distributorId,
    type: 'access_request',
    message: `${userData.email} has requested access to your catalog.`,
    isRead: false,
    createdAt: Timestamp.now(),
    requesterUid: auth.uid,
    requesterEmail: userData.email || auth.email,
    requesterName: requesterName || userData.companyName,
    requestStatus: 'pending',
  });

  return NextResponse.json({ success: true, message: 'Access request sent.' });
}

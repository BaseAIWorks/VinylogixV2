import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth, authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { resolveDistributorBySlug } from '@/lib/storefront-helpers';
import { Timestamp } from 'firebase-admin/firestore';
import { sendAccessRequestNotification, sendAccessRequestConfirmation } from '@/services/email-service';

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

  // Build requester profile
  const requesterName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || undefined;
  const requesterEmail = userData.email || auth.email;

  // Create access request notification for the distributor
  await adminDb.collection('notifications').add({
    distributorId,
    type: 'access_request',
    message: `${requesterEmail} has requested access to your catalog.`,
    isRead: false,
    createdAt: Timestamp.now(),
    requesterUid: auth.uid,
    requesterEmail,
    requesterName,
    requesterCompanyName: userData.companyName || undefined,
    requesterPhone: userData.phoneNumber || undefined,
    requesterCity: userData.city || undefined,
    requesterCountry: userData.country || undefined,
    requesterVatNumber: userData.vatNumber || undefined,
    requestStatus: 'pending',
  });

  // Send email notification to the distributor
  const distributorEmail = distData.contactEmail;
  if (distributorEmail) {
    const distributorName = distData.companyName || distData.name;
    await sendAccessRequestNotification({
      distributorEmail,
      distributorName,
      requesterEmail: requesterEmail!,
      requesterName,
      requesterCompanyName: userData.companyName,
      requesterPhone: userData.phoneNumber,
      requesterCity: userData.city,
      requesterCountry: userData.country,
    });
  }

  // Send confirmation email to the requester
  const distributorName = distData.companyName || distData.name;
  await sendAccessRequestConfirmation(requesterEmail!, distributorName);

  return NextResponse.json({ success: true, message: 'Access request sent.' });
}

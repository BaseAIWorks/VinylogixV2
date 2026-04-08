import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreUser } from '@/types';
import { sendNewAccountInvitationEmail, sendExistingAccountInvitationEmail } from '@/services/email-service';
import { requireAuth, authErrorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { randomBytes } from 'crypto';

function generatePassword(length: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = lowercase + uppercase + numbers + symbols;

  const bytes = randomBytes(length);
  const chars = [
    lowercase[bytes[0] % lowercase.length],
    uppercase[bytes[1] % uppercase.length],
    numbers[bytes[2] % numbers.length],
    symbols[bytes[3] % symbols.length],
  ];

  for (let i = 4; i < length; i++) {
    chars.push(allChars[bytes[i] % allChars.length]);
  }

  // Fisher-Yates shuffle with crypto
  const shuffleBytes = randomBytes(chars.length);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

export async function POST(req: NextRequest) {
  // Rate limit: 10 invites per minute per IP
  const rateLimited = rateLimit(req, { limit: 10, windowMs: 60_000, prefix: 'invite' });
  if (rateLimited) return rateLimited;

  try {
    // Verify authentication
    const caller = await requireAuth(req);

    const { email, distributorId } = await req.json();

    if (!email || !distributorId) {
      return NextResponse.json(
        { error: 'Missing required fields.' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Service unavailable.' },
        { status: 500 }
      );
    }

    // Verify caller is master of the specified distributor
    const inviterDoc = await adminDb.collection('users').doc(caller.uid).get();
    if (!inviterDoc.exists) {
      return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
    }

    const inviterData = inviterDoc.data() as FirestoreUser;
    if (inviterData.role !== 'master' || inviterData.distributorId !== distributorId) {
      return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 });
    }

    // Get distributor information for email
    const distributorDoc = await adminDb.collection('distributors').doc(distributorId).get();
    if (!distributorDoc.exists) {
      return NextResponse.json({ error: 'Operation failed.' }, { status: 400 });
    }

    const distributorData = distributorDoc.data();
    const distributorInfo = {
      name: distributorData?.name || 'Unknown Distributor',
      companyName: distributorData?.companyName || distributorData?.name,
      contactEmail: distributorData?.contactEmail || inviterData.email || 'support@vinylogix.com'
    };

    const websiteUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
    }

    // Check if user already exists in Firestore
    const existingUserQuery = await adminDb.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existingUserQuery.empty) {
      const existingUser = existingUserQuery.docs[0].data() as FirestoreUser;

      if (existingUser.accessibleDistributorIds?.includes(distributorId)) {
        // Generic response to prevent user enumeration
        return NextResponse.json({ success: true, message: 'Invitation processed successfully.', userCreated: false });
      }

      if ((existingUser.role === 'master' || existingUser.role === 'worker') &&
          existingUser.distributorId === distributorId) {
        return NextResponse.json({ success: true, message: 'Invitation processed successfully.', userCreated: false });
      }

      if (existingUser.role === 'superadmin') {
        return NextResponse.json({ success: true, message: 'Invitation processed successfully.', userCreated: false });
      }

      // Grant access and track invite
      await existingUserQuery.docs[0].ref.update({
        accessibleDistributorIds: FieldValue.arrayUnion(distributorId),
        invitedAt: Timestamp.now(),
        invitedByDistributorId: distributorId,
        invitedByUid: caller.uid,
      });

      try {
        await sendExistingAccountInvitationEmail({ clientEmail: email, distributor: distributorInfo, websiteUrl });
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
      }

      return NextResponse.json({ success: true, message: 'Invitation sent successfully.', userCreated: false });
    }

    // Create new user
    const temporaryPassword = generatePassword();

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 500 });
    }

    try {
      const userRecord = await adminAuth.createUser({
        email,
        password: temporaryPassword,
        emailVerified: false,
      });

      const newTimestamp = Timestamp.now();
      const newUserFirestoreData = {
        email,
        role: 'viewer',
        accessibleDistributorIds: [distributorId],
        favorites: [],
        createdAt: newTimestamp,
        lastLoginAt: newTimestamp,
        loginHistory: [newTimestamp],
        profileComplete: false,
        invitedAt: newTimestamp,
        invitedByDistributorId: distributorId,
        invitedByUid: caller.uid,
      };

      await adminDb.collection('users').doc(userRecord.uid).set(newUserFirestoreData);

      try {
        await sendNewAccountInvitationEmail({ clientEmail: email, temporaryPassword, distributor: distributorInfo, websiteUrl });
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
      }

      return NextResponse.json({ success: true, message: 'Client account created successfully.', userCreated: true });

    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        // Generic response
        return NextResponse.json({ success: true, message: 'Invitation processed successfully.', userCreated: false });
      }
      throw authError;
    }

  } catch (error: any) {
    if (error.status) return authErrorResponse(error);
    console.error('Error in client invite:', error);
    return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
  }
}

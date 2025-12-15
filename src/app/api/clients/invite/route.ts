import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { FirestoreUser } from '@/types';
import { sendNewAccountInvitationEmail, sendExistingAccountInvitationEmail } from '@/services/email-service';

// Force dynamic rendering to avoid build-time initialization issues
export const dynamic = 'force-dynamic';

// Generate a secure random password
function generatePassword(length: number = 12): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest with random characters
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export async function POST(req: NextRequest) {
  try {
    const { email, distributorId, invitedBy } = await req.json();

    if (!email || !distributorId || !invitedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: email, distributorId, and invitedBy are required' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json(
        { error: 'Firebase Admin SDK is not initialized' },
        { status: 500 }
      );
    }

    // Verify that the invitedBy user is a master user of the specified distributor
    const inviterDoc = await adminDb.collection('users').doc(invitedBy).get();
    if (!inviterDoc.exists) {
      return NextResponse.json(
        { error: 'Invalid inviter' },
        { status: 403 }
      );
    }

    const inviterData = inviterDoc.data() as FirestoreUser;
    if (inviterData.role !== 'master' || inviterData.distributorId !== distributorId) {
      return NextResponse.json(
        { error: 'Only master users can invite clients to their distributorship' },
        { status: 403 }
      );
    }

    // Get distributor information for email
    const distributorDoc = await adminDb.collection('distributors').doc(distributorId).get();
    if (!distributorDoc.exists) {
      return NextResponse.json(
        { error: 'Distributor not found' },
        { status: 404 }
      );
    }
    
    const distributorData = distributorDoc.data();
    const distributorInfo = {
      name: distributorData?.name || 'Unknown Distributor',
      companyName: distributorData?.companyName || distributorData?.name,
      contactEmail: distributorData?.contactEmail || inviterData.email || 'support@vinylogix.com'
    };

    // Get the website URL from the request
    const websiteUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if user already exists in Firestore
    const existingUserQuery = await adminDb.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get();

    if (!existingUserQuery.empty) {
      const existingUser = existingUserQuery.docs[0].data() as FirestoreUser;
      
      // If user exists and is already a viewer with access to this distributor
      if (existingUser.role === 'viewer' && 
          existingUser.accessibleDistributorIds?.includes(distributorId)) {
        return NextResponse.json(
          { error: 'This user already has access to your distributorship' },
          { status: 409 }
        );
      }
      
      // If user exists but is not a viewer, they can't be invited as a client
      if (existingUser.role !== 'viewer') {
        return NextResponse.json(
          { error: 'This email is associated with a non-client account and cannot be invited as a client' },
          { status: 409 }
        );
      }

      // If user exists and is a viewer but doesn't have access, grant access
      await existingUserQuery.docs[0].ref.update({
        accessibleDistributorIds: FieldValue.arrayUnion(distributorId)
      });

      // Send email to existing user
      try {
        await sendExistingAccountInvitationEmail({
          clientEmail: email,
          distributor: distributorInfo,
          websiteUrl
        });
      } catch (emailError) {
        console.error('Failed to send existing account invitation email:', emailError);
        // Don't fail the entire operation if email fails
      }

      return NextResponse.json({
        success: true,
        message: 'Access granted to existing client account',
        userCreated: false
      });
    }

    // Generate a temporary password
    const temporaryPassword = generatePassword();

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json(
        { error: 'Firebase Admin Auth is not available' },
        { status: 500 }
      );
    }

    try {
      // Create user in Firebase Auth
      const userRecord = await adminAuth.createUser({
        email: email,
        password: temporaryPassword,
        emailVerified: false,
      });

      // Create user document in Firestore
      const newTimestamp = Timestamp.now();
      const newUserFirestoreData: FirestoreUser = {
        email,
        role: 'viewer',
        accessibleDistributorIds: [distributorId],
        favorites: [],
        createdAt: newTimestamp,
        lastLoginAt: newTimestamp,
        loginHistory: [newTimestamp],
        profileComplete: false,
      };

      await adminDb.collection('users').doc(userRecord.uid).set(newUserFirestoreData);

      // Send welcome email with temporary password
      try {
        await sendNewAccountInvitationEmail({
          clientEmail: email,
          temporaryPassword,
          distributor: distributorInfo,
          websiteUrl
        });
      } catch (emailError) {
        console.error('Failed to send new account invitation email:', emailError);
        // Don't fail the entire operation if email fails
      }

      return NextResponse.json({
        success: true,
        message: 'Client account created successfully',
        userCreated: true,
        userId: userRecord.uid
      });

    } catch (authError: any) {
      // If Firebase Auth user creation fails but user might exist in Auth but not Firestore
      if (authError.code === 'auth/email-already-exists') {
        return NextResponse.json(
          { error: 'An account with this email already exists in the authentication system but not in our database. Please contact support.' },
          { status: 409 }
        );
      }
      throw authError;
    }

  } catch (error: any) {
    console.error('Error creating client account:', error);
    return NextResponse.json(
      { error: `Failed to create client account: ${error.message}` },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { sendPasswordResetEmail } from '@/services/email-service';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required.' },
        { status: 400 }
      );
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.error('Firebase Admin Auth not initialized');
      return NextResponse.json(
        { error: 'Server configuration error.' },
        { status: 500 }
      );
    }

    // Generate password reset link using Firebase Admin SDK
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    const actionCodeSettings = {
      url: `${siteUrl}/login?passwordReset=success`,
      handleCodeInApp: false,
    };

    const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

    // Send the email via Resend
    await sendPasswordResetEmail(email, resetLink);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Password reset error:', error);

    // Handle specific Firebase errors
    if (error.code === 'auth/user-not-found') {
      // For security, don't reveal if user exists or not
      return NextResponse.json({ success: true });
    }

    if (error.code === 'auth/invalid-email') {
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send password reset email. Please try again.' },
      { status: 500 }
    );
  }
}

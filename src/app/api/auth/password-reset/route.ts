import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { sendPasswordResetEmail } from '@/services/email-service';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  // Rate limit: 5 resets per minute per IP
  const rateLimited = rateLimit(req, { limit: 5, windowMs: 60_000, prefix: 'pw-reset' });
  if (rateLimited) return rateLimited;

  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      console.error('Firebase Admin Auth not initialized');
      return NextResponse.json({ error: 'Service unavailable.' }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

    const actionCodeSettings = {
      url: `${siteUrl}/login?passwordReset=success`,
      handleCodeInApp: false,
    };

    const resetLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);
    await sendPasswordResetEmail(email, resetLink);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Password reset error:', error);

    if (error.code === 'auth/user-not-found') {
      return NextResponse.json({ success: true });
    }

    if (error.code === 'auth/invalid-email') {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to send password reset email. Please try again.' }, { status: 500 });
  }
}

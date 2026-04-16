import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { getAdminDb } from '@/lib/firebase-admin';

export interface AuthResult {
  uid: string;
  role?: string;
  distributorId?: string;
  email?: string;
}

/**
 * Verifies Firebase ID token from Authorization header.
 * Returns verified user info or null if no token/invalid token.
 */
export async function verifyAuth(req: NextRequest): Promise<AuthResult | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.split('Bearer ')[1];
  if (!idToken) return null;

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    throw new Error('Authentication service unavailable.');
  }

  const decodedToken = await adminAuth.verifyIdToken(idToken);

  let role = decodedToken.role as string | undefined;
  let distributorId = decodedToken.distributorId as string | undefined;

  // Fallback to Firestore if claims not synced yet
  if (!role) {
    const adminDb = getAdminDb();
    if (adminDb) {
      const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        role = userData?.role;
        distributorId = userData?.distributorId;
      }
    }
  }

  return {
    uid: decodedToken.uid,
    role,
    distributorId,
    email: decodedToken.email,
  };
}

/**
 * Requires authentication. Returns AuthResult or sends 401 response.
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const auth = await verifyAuth(req);
  if (!auth) {
    throw new AuthError('Authentication required.', 401);
  }
  return auth;
}

/**
 * Requires a specific role. Returns AuthResult or sends 403 response.
 */
export async function requireRole(req: NextRequest, roles: string[]): Promise<AuthResult> {
  const auth = await requireAuth(req);
  if (!auth.role || !roles.includes(auth.role)) {
    throw new AuthError('Insufficient permissions.', 403);
  }
  return auth;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function authErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error && typeof error === 'object' && typeof (error as any).status === 'number') {
    const e = error as any;
    return NextResponse.json({ error: e.message || 'Request failed.' }, { status: e.status });
  }
  return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
}

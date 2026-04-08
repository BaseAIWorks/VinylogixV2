import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { resolveDistributorBySlug, checkUserAccessToDistributor } from '@/lib/storefront-helpers';

// Public-safe fields to return from a distributor document
const PUBLIC_FIELDS = [
  'name', 'companyName', 'logoUrl', 'slug', 'visibility',
  'storefrontSettings', 'cardDisplaySettings',
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 60, windowMs: 60_000, prefix: 'storefront' });
  if (rateLimited) return rateLimited;

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: 'Slug is required.' }, { status: 400 });
  }

  const result = await resolveDistributorBySlug(slug);
  if (!result) {
    return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 });
  }

  const { id: distributorId, data } = result;
  const visibility = data.visibility || 'private';

  // Check visibility access
  if (visibility === 'open') {
    return NextResponse.json({
      id: distributorId,
      ...pickPublicFields(data),
    });
  }

  // Private and invite_only both require authentication
  const auth = await verifyAuth(req);
  if (!auth) {
    return NextResponse.json(
      { error: 'Authentication required.', visibility },
      { status: 401 }
    );
  }

  // For invite_only, also check that the user is an approved client or operator
  if (visibility === 'invite_only') {
    const hasAccess = await checkUserAccessToDistributor(auth.uid, distributorId);
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'This catalog is invite-only.', visibility },
        { status: 403 }
      );
    }
  }

  return NextResponse.json({
    id: distributorId,
    ...pickPublicFields(data),
  });
}

function pickPublicFields(data: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const field of PUBLIC_FIELDS) {
    if (data[field] !== undefined) {
      result[field] = data[field];
    }
  }
  return result;
}

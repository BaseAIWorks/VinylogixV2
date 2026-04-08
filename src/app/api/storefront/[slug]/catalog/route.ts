import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { resolveDistributorBySlug, checkUserAccessToDistributor } from '@/lib/storefront-helpers';

// Fields safe for public (no-price) display
const PUBLIC_RECORD_FIELDS = [
  'id', 'title', 'artist', 'year', 'genre', 'style', 'format', 'formatDetails',
  'country', 'media_condition', 'sleeve_condition', 'cover_url', 'label',
] as const;

// Additional fields for approved clients
const CLIENT_RECORD_FIELDS = ['sellingPrice'] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimited = rateLimit(req, { limit: 60, windowMs: 60_000, prefix: 'storefront-catalog' });
  if (rateLimited) return rateLimited;

  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: 'Slug is required.' }, { status: 400 });
  }

  const result = await resolveDistributorBySlug(slug);
  if (!result) {
    return NextResponse.json({ error: 'Distributor not found.' }, { status: 404 });
  }

  const { id: distributorId, data: distData } = result;
  const visibility = distData.visibility || 'private';
  const lowStockThreshold = distData.lowStockThreshold || 3;

  // Check visibility access
  const auth = await verifyAuth(req);
  let isApprovedClient = false;

  if (visibility === 'open') {
    // Public access allowed — check if user is also an approved client for price display
    if (auth) {
      isApprovedClient = await checkUserAccessToDistributor(auth.uid, distributorId);
    }
  } else if (visibility === 'private') {
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required.', visibility },
        { status: 401 }
      );
    }
    isApprovedClient = await checkUserAccessToDistributor(auth.uid, distributorId);
  } else if (visibility === 'invite_only') {
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required.', visibility },
        { status: 401 }
      );
    }
    isApprovedClient = await checkUserAccessToDistributor(auth.uid, distributorId);
    if (!isApprovedClient) {
      return NextResponse.json(
        { error: 'This catalog is invite-only.', visibility },
        { status: 403 }
      );
    }
  }

  // Parse query params
  const adminDb = getAdminDb()!;
  const url = new URL(req.url);
  const cursor = url.searchParams.get('cursor');
  const limitParam = Math.min(parseInt(url.searchParams.get('limit') || '25'), 50);
  const search = url.searchParams.get('search')?.toLowerCase();
  const genre = url.searchParams.get('genre');
  const format = url.searchParams.get('format');

  // Build query
  let query: FirebaseFirestore.Query = adminDb
    .collection('vinylRecords')
    .where('distributorId', '==', distributorId)
    .where('isInventoryItem', '==', true)
    .orderBy('added_at', 'desc');

  // Cursor-based pagination
  if (cursor) {
    const cursorDoc = await adminDb.collection('vinylRecords').doc(cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  // Fetch more than limit to allow server-side filtering for search
  const fetchLimit = search ? 200 : limitParam + 1;
  query = query.limit(fetchLimit);

  const snapshot = await query.get();
  let records: any[] = snapshot.docs.map((doc: any) => {
    const data = doc.data();
    return { docId: doc.id, ...data };
  });

  // Apply filters (Firestore doesn't support multiple inequality/array-contains together easily)
  if (search) {
    records = records.filter((r: any) =>
      r.title?.toLowerCase().includes(search) ||
      r.artist?.toLowerCase().includes(search) ||
      r.label?.toLowerCase().includes(search)
    );
  }
  if (genre) {
    records = records.filter((r: any) =>
      Array.isArray(r.genre) && r.genre.some((g: string) => g.toLowerCase() === genre.toLowerCase())
    );
  }
  if (format) {
    records = records.filter((r: any) =>
      r.formatDetails?.toLowerCase().includes(format.toLowerCase())
    );
  }

  // Pagination
  const hasMore = records.length > limitParam;
  const resultRecords = records.slice(0, limitParam);

  // Strip to safe fields
  const safeRecords = resultRecords.map((record: any) => {
    const safe: Record<string, any> = { id: record.docId };

    for (const field of PUBLIC_RECORD_FIELDS) {
      if (record[field] !== undefined) {
        safe[field] = record[field];
      }
    }

    // Stock availability (not raw numbers)
    const totalStock = (record.stock_shelves || 0) + (record.stock_storage || 0);
    if (totalStock === 0) {
      safe.stockStatus = 'out_of_stock';
    } else if (totalStock <= lowStockThreshold) {
      safe.stockStatus = 'low_stock';
    } else {
      safe.stockStatus = 'in_stock';
    }

    // Only approved clients see prices
    if (isApprovedClient) {
      for (const field of CLIENT_RECORD_FIELDS) {
        if (record[field] !== undefined) {
          safe[field] = record[field];
        }
      }
    }

    return safe;
  });

  const nextCursor = resultRecords.length > 0 && hasMore
    ? resultRecords[resultRecords.length - 1].docId
    : null;

  return NextResponse.json({
    records: safeRecords,
    nextCursor,
    hasMore,
    isApprovedClient,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyAuth } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';
import { resolveDistributorBySlug, checkUserAccessToDistributor } from '@/lib/storefront-helpers';

// Fields safe for public (no-price) display
const PUBLIC_RECORD_FIELDS = [
  'id', 'title', 'artist', 'year', 'genre', 'style', 'format', 'formatDetails',
  'country', 'media_condition', 'sleeve_condition', 'cover_url', 'label', 'tracklist',
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

  // Build query — when searching/filtering, skip orderBy so records with missing
  // or mismatched added_at fields aren't silently excluded from results.
  const isFiltering = !!(search || genre || format);
  let query: FirebaseFirestore.Query = adminDb
    .collection('vinylRecords')
    .where('distributorId', '==', distributorId)
    .where('isInventoryItem', '==', true);

  if (!isFiltering) {
    // Normal browsing: orderBy + cursor pagination + limit
    query = query.orderBy('added_at', 'desc');
    if (cursor) {
      const cursorDoc = await adminDb.collection('vinylRecords').doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc);
      }
    }
    query = query.limit(limitParam + 1);
  }
  // When searching/filtering: no orderBy, no limit — scan full inventory

  const snapshot = await query.get();
  let records: any[] = snapshot.docs.map((doc: any) => {
    const data = doc.data();
    return { docId: doc.id, ...data };
  });

  // Apply search + filters in memory
  if (search) {
    records = records.filter((r: any) =>
      r.title?.toLowerCase().includes(search) ||
      r.artist?.toLowerCase().includes(search) ||
      r.label?.toLowerCase().includes(search) ||
      (r.barcode && r.barcode.toLowerCase().includes(search))
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

  // Sort by added_at desc in memory when filtering (since we skipped orderBy)
  if (isFiltering) {
    records.sort((a: any, b: any) => {
      const aMs = a.added_at?.toDate?.()?.getTime?.() ?? new Date(a.added_at || 0).getTime();
      const bMs = b.added_at?.toDate?.()?.getTime?.() ?? new Date(b.added_at || 0).getTime();
      return bMs - aMs;
    });
  }

  // Pagination — when filtering, all results are already in memory so return them all.
  // Cursor pagination doesn't work for filtered results (no orderBy → no stable cursor).
  const hasMore = isFiltering ? false : records.length > limitParam;
  const resultRecords = isFiltering ? records : records.slice(0, limitParam);

  // Strip to safe fields
  const safeRecords = resultRecords.map((record: any) => {
    const safe: Record<string, any> = { id: record.docId };

    for (const field of PUBLIC_RECORD_FIELDS) {
      if (record[field] !== undefined) {
        safe[field] = record[field];
      }
    }

    // Stock availability (not raw numbers). Uses available = stock - reserved
    // so items held by open orders don't show as in-stock to other customers.
    const totalStock = (record.stock_shelves || 0) + (record.stock_storage || 0);
    const availableStock = Math.max(0, totalStock - (record.reserved || 0));
    if (availableStock === 0) {
      safe.stockStatus = 'out_of_stock';
    } else if (availableStock <= lowStockThreshold) {
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

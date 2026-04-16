import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireAuth, authErrorResponse } from '@/lib/auth-helpers';
import { countryToViesCode, stripVatPrefix } from '@/lib/tax-utils';

const VIES_API_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number';

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (error) {
    return authErrorResponse(error);
  }

  const body = await req.json();
  const { vatNumber, country, clientUid } = body as {
    vatNumber: string;
    country: string;
    clientUid?: string; // If provided, store validation result on user doc
  };

  if (!vatNumber || !country) {
    return NextResponse.json({ error: 'VAT number and country are required.' }, { status: 400 });
  }

  const countryCode = countryToViesCode(country);
  if (!countryCode) {
    return NextResponse.json({ error: `Could not determine EU member state for "${country}". VIES only supports EU countries.` }, { status: 400 });
  }

  const cleanVat = stripVatPrefix(vatNumber, countryCode);

  try {
    const viesResponse = await fetch(VIES_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        countryCode,
        vatNumber: cleanVat,
      }),
    });

    if (!viesResponse.ok) {
      const errorText = await viesResponse.text();
      console.error('VIES API error:', viesResponse.status, errorText);
      return NextResponse.json(
        { error: 'VIES service is temporarily unavailable. Please try again later.' },
        { status: 502 }
      );
    }

    const viesData = await viesResponse.json();

    const result = {
      valid: viesData.valid === true,
      countryCode,
      vatNumber: cleanVat,
      name: viesData.name || null,
      address: viesData.address || null,
    };

    // Store validation result on user document if clientUid provided.
    // Every branch that SKIPS the write now logs why — previous versions
    // silently returned `persisted: false` which made verify-flows that
    // looked successful to the user (local React state updated) invisibly
    // fail to stick across refreshes.
    let persisted = false;
    let persistSkipReason: string | null = null;
    if (!clientUid) {
      persistSkipReason = 'no-client-uid';
    } else {
      const adminDb = getAdminDb();
      if (!adminDb) {
        persistSkipReason = 'admin-db-unavailable';
        console.error(`[verify-vat] Admin DB not initialised; cannot persist vatValidated for client ${clientUid}.`);
      } else {
        const callerSnap = await adminDb.collection('users').doc(auth.uid).get();
        const callerData = callerSnap.exists ? callerSnap.data() : null;
        const callerRole = callerData?.role;
        if (!callerData) {
          persistSkipReason = 'caller-doc-missing';
          console.error(`[verify-vat] Caller user doc ${auth.uid} not found; cannot persist.`);
        } else if (callerRole !== 'master' && callerRole !== 'worker' && callerRole !== 'superadmin') {
          // Don't leak the caller's actual role to the client in the response —
          // log it server-side only. The surfaced reason stays generic.
          persistSkipReason = 'insufficient-role';
          console.warn(`[verify-vat] Caller ${auth.uid} has role "${callerRole}"; vatValidated not persisted for client ${clientUid}.`);
        } else {
          try {
            await adminDb.collection('users').doc(clientUid).update({
              vatValidated: result.valid,
              vatValidatedAt: new Date().toISOString(),
              ...(result.valid && result.name ? { vatValidatedName: result.name } : {}),
            });
            persisted = true;
          } catch (writeErr) {
            persistSkipReason = 'firestore-write-failed';
            console.error(`[verify-vat] Firestore update failed for client ${clientUid}:`, writeErr);
          }
        }
      }
    }

    import('@/services/system-log-service').then(m => m.logSystemEvent({
      type: 'api_call',
      source: 'vies_api',
      status: result.valid ? 'success' : 'warning',
      message: `VAT check: ${countryCode}${cleanVat} → ${result.valid ? 'valid' : 'invalid'}`,
      userId: auth?.uid,
      userEmail: auth?.email,
      userRole: auth?.role,
      page: clientUid ? `/clients/${clientUid}` : '/clients',
    }));
    return NextResponse.json({ ...result, persisted, ...(persistSkipReason ? { persistSkipReason } : {}) });
  } catch (error: any) {
    console.error('VIES validation error:', error);
    import('@/services/system-log-service').then(m => m.logSystemEvent({
      type: 'api_error',
      source: 'vies_api',
      status: 'error',
      message: `VIES error: ${error.message}`,
      userId: auth?.uid,
      userEmail: auth?.email,
      userRole: auth?.role,
      page: clientUid ? `/clients/${clientUid}` : '/clients',
    }));
    return NextResponse.json(
      { error: 'Failed to validate VAT number. Please try again.' },
      { status: 500 }
    );
  }
}

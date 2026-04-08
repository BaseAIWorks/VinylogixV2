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

    // Store validation result on user document if clientUid provided
    let persisted = false;
    if (clientUid) {
      const adminDb = getAdminDb();
      if (adminDb) {
        // Verify caller is a master user before writing to another user's doc
        const callerSnap = await adminDb.collection('users').doc(auth.uid).get();
        const callerData = callerSnap.data();
        if (callerData?.role === 'master' || callerData?.role === 'worker') {
          await adminDb.collection('users').doc(clientUid).update({
            vatValidated: result.valid,
            vatValidatedAt: new Date().toISOString(),
            ...(result.valid && result.name ? { vatValidatedName: result.name } : {}),
          });
          persisted = true;
        }
      }
    }

    return NextResponse.json({ ...result, persisted });
  } catch (error: any) {
    console.error('VIES validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate VAT number. Please try again.' },
      { status: 500 }
    );
  }
}

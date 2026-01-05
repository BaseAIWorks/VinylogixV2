import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { FirestoreUser } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { clientUid, distributorId, requestedBy } = await req.json();

    if (!clientUid || !distributorId || !requestedBy) {
      return NextResponse.json(
        { error: 'Missing required fields: clientUid, distributorId, and requestedBy are required' },
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

    // Verify that the requestedBy user is a master user of the specified distributor
    const requesterDoc = await adminDb.collection('users').doc(requestedBy).get();
    if (!requesterDoc.exists) {
      return NextResponse.json(
        { error: 'Invalid requester' },
        { status: 403 }
      );
    }

    const requesterData = requesterDoc.data() as FirestoreUser;
    if (requesterData.role !== 'master' || requesterData.distributorId !== distributorId) {
      return NextResponse.json(
        { error: 'Only master users can remove clients from their distributorship' },
        { status: 403 }
      );
    }

    // Get the client document
    const clientDoc = await adminDb.collection('users').doc(clientUid).get();
    if (!clientDoc.exists) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const clientData = clientDoc.data() as FirestoreUser;

    // Verify the client has access to this distributor
    if (!clientData.accessibleDistributorIds?.includes(distributorId)) {
      return NextResponse.json(
        { error: 'This client does not have access to your distributorship' },
        { status: 400 }
      );
    }

    // Remove the distributorId from the client's accessibleDistributorIds array
    await clientDoc.ref.update({
      accessibleDistributorIds: FieldValue.arrayRemove(distributorId)
    });

    return NextResponse.json({
      success: true,
      message: 'Client access has been revoked successfully'
    });

  } catch (error: any) {
    console.error('Error removing client access:', error);
    return NextResponse.json(
      { error: `Failed to remove client access: ${error.message}` },
      { status: 500 }
    );
  }
}

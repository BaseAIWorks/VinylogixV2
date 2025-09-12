
'use server';

import type { MasterRecord, User } from '@/types';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { getDiscogsReleaseDetailsById } from './discogs-service';
import { generateRecordInfo } from '@/ai/flows/generate-record-info-flow';

const MASTER_RECORDS_COLLECTION = 'masterRecords';

const processMasterRecordTimestamps = (recordData: any): MasterRecord => {
  const processed = { ...recordData };
  if (processed.lastFetchedAt && typeof processed.lastFetchedAt.toDate === 'function') {
    processed.lastFetchedAt = processed.lastFetchedAt.toDate().toISOString();
  }
  return processed as MasterRecord;
};

export async function findOrCreateMasterRecord(
  discogsId: number,
  actingUser: User,
  allowAiFeatures: boolean
): Promise<MasterRecord | null> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error("Admin SDK is not initialized. Master record creation is disabled. Check server configuration.");
  }

  const masterRecordDocRef = adminDb.collection(MASTER_RECORDS_COLLECTION).doc(discogsId.toString());

  const docSnap = await masterRecordDocRef.get();
  if (docSnap.exists) {
    return processMasterRecordTimestamps({ ...docSnap.data(), id: docSnap.id });
  }
  
  const discogsDetails = await getDiscogsReleaseDetailsById(discogsId.toString(), actingUser.distributorId);
  if (!discogsDetails) {
      throw new Error(`Could not fetch details for Discogs ID ${discogsId}. Master record not created.`);
  }

  let aiInfo = { artistBio: '', albumInfo: '' };
  
  if (allowAiFeatures && actingUser.role !== 'viewer' && discogsDetails.artist && discogsDetails.title) {
      try {
          aiInfo = await generateRecordInfo({
              artist: discogsDetails.artist,
              title: discogsDetails.title,
              year: discogsDetails.year,
              distributorId: actingUser.distributorId,
          });
      } catch (aiError) {
          console.warn(`AI content generation failed for Discogs ID ${discogsId}, proceeding without it.`, aiError);
      }
  }
  
  const newMasterRecord: Omit<MasterRecord, 'id'> = {
      discogs_id: discogsId,
      barcode: discogsDetails.barcode,
      title: discogsDetails.title || 'Unknown Title',
      artist: discogsDetails.artist || 'Unknown Artist',
      label: discogsDetails.label,
      year: discogsDetails.year,
      releasedDate: discogsDetails.releasedDate,
      genre: discogsDetails.genre,
      style: discogsDetails.style,
      country: discogsDetails.country,
      formatDetails: discogsDetails.formatDetails,
      cover_url: discogsDetails.cover_url,
      tracklist: discogsDetails.tracklist,
      dataAiHint: discogsDetails.dataAiHint,
      artistBio: aiInfo.artistBio,
      albumInfo: aiInfo.albumInfo,
      lastFetchedAt: new Date().toISOString(),
  };

  await masterRecordDocRef.set({
      ...newMasterRecord,
      lastFetchedAt: Timestamp.now(),
  });

  return { ...newMasterRecord, id: discogsId.toString() };
}

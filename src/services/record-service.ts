
"use client";

import type { VinylRecord, User, SortOption, Distributor, SearchResult } from '@/types';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit as firestoreLimit,
  Timestamp,
  orderBy,
  startAfter,
  DocumentSnapshot,
  writeBatch,
  Query,
  DocumentData,
  QuerySnapshot,
  runTransaction,
} from 'firebase/firestore';
import { handleLowStockNotification } from './notification-service';
import { getDistributorById } from './distributor-service';
import type { OrderItem } from '@/types';


const RECORDS_COLLECTION = 'vinylRecords';

function cleanDataForFirestore<T extends Record<string, any>>(data: T): Partial<T> {
  const cleanedData: Partial<T> = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
      cleanedData[key as keyof Partial<T>] = data[key];
    }
  }
  return cleanedData;
}

const processRecordTimestamps = (recordData: any): VinylRecord => {
  const processed = { ...recordData };
  if (processed.added_at && processed.added_at instanceof Timestamp) {
    processed.added_at = processed.added_at.toDate().toISOString();
  }
  if (processed.last_modified_at && processed.last_modified_at instanceof Timestamp) {
    processed.last_modified_at = processed.last_modified_at.toDate().toISOString();
  }
   if (processed.lastFetchedAt && typeof processed.lastFetchedAt.toDate === 'function') {
    processed.lastFetchedAt = processed.lastFetchedAt.toDate().toISOString();
  }
  return processed as VinylRecord;
};

// This function is for fetching ALL inventory records for a distributor without pagination
// Used by dashboard, stats pages, and now the search functionality.
export async function getAllInventoryRecords(user: User, distributorId?: string): Promise<VinylRecord[]> {
  const targetDistributorId = distributorId || user.distributorId;
  if (!targetDistributorId) {
    console.error("RecordService: Distributor ID is missing, cannot fetch inventory.");
    return [];
  }
  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  try {
    const q = query(
      recordsCollectionRef,
      where("distributorId", "==", targetDistributorId),
      where("isInventoryItem", "==", true)
    );
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(docSnap => processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }));
    return records;
  } catch (error) {
    console.error(`RecordService: Error fetching all inventory for distributor ${targetDistributorId}:`, error);
    // Ensure it always returns an array, even on error.
    return [];
  }
}

// New function for global search
export async function searchRecordsByTerm(term: string, distributorId: string): Promise<SearchResult[]> {
    if (!term || !distributorId) {
        return [];
    }
    const lowerCaseTerm = term.toLowerCase();
    const recordsCollectionRef = collection(db, RECORDS_COLLECTION);

    // Note: Firestore does not support case-insensitive search or partial string matching directly in queries.
    // For a production app with large datasets, a dedicated search service like Algolia or Elasticsearch is recommended.
    // For this implementation, we will fetch all records and filter on the client side, which is feasible for small to medium inventories.
    // To make this more scalable without a third-party service, you would typically store searchable keywords in lowercase in the document.

    try {
        const q = query(
            recordsCollectionRef,
            where("distributorId", "==", distributorId),
            where("isInventoryItem", "==", true)
        );
        const querySnapshot = await getDocs(q);
        const allRecords = querySnapshot.docs.map(docSnap => ({...docSnap.data(), id: docSnap.id})) as (VinylRecord & {id: string})[];
        
        const filteredRecords = allRecords
            .filter(record => 
                record.title?.toLowerCase().includes(lowerCaseTerm) || 
                record.artist?.toLowerCase().includes(lowerCaseTerm)
            )
            .map(record => ({
                id: record.id,
                title: record.title,
                artist: record.artist,
                cover_url: record.cover_url,
            }));

        return filteredRecords.slice(0, 10); // Return top 10 results
    } catch (error) {
        console.error(`RecordService: Error searching records for term "${term}":`, error);
        throw error;
    }
}


// This function is for the main inventory page with FILTERING, SORTING, and PAGINATION
export async function getInventoryRecords(
  user: User,
  options: {
    distributorId?: string | null;
    filters?: Record<string, string | undefined>;
    sortOption?: SortOption;
    limit?: number;
    lastVisible?: DocumentSnapshot | null;
    searchTerm?: string;
  }
): Promise<{ records: VinylRecord[], lastVisible: DocumentSnapshot | null }> {
  const { distributorId, filters = {}, sortOption = 'added_at_desc', limit = 25, lastVisible, searchTerm } = options;
  const targetDistributorId = user.role === 'viewer' ? distributorId : user.distributorId;

  if (!targetDistributorId) {
    if (user.role === 'viewer') return { records: [], lastVisible: null };
    throw new Error("Missing or insufficient permissions.");
  }

  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  const isSearching = !!searchTerm && searchTerm.trim().length >= 2;

  let q: Query<DocumentData>;

  if (isSearching) {
    // Search: minimal query — no orderBy, no filters, no limit.
    // orderBy silently excludes docs missing the field or with mismatched types,
    // so we fetch everything and handle filtering + sorting in memory.
    q = query(
      recordsCollectionRef,
      where("distributorId", "==", targetDistributorId),
      where("isInventoryItem", "==", true)
    );
  } else {
    // Normal browsing: apply Firestore filters, sort, pagination, and limit.
    q = query(
      recordsCollectionRef,
      where("distributorId", "==", targetDistributorId),
      where("isInventoryItem", "==", true)
    );

    if (filters.year) q = query(q, where("year", "==", Number(filters.year)));
    if (filters.genre) q = query(q, where("genre", "array-contains", filters.genre));
    if (filters.format) q = query(q, where("formatDetails", "==", filters.format));
    if (filters.condition) q = query(q, where("media_condition", "==", filters.condition));
    if (filters.location) q = query(q, where("shelf_locations", "array-contains", filters.location));

    switch (sortOption) {
      case 'title_asc':
        q = query(q, orderBy("title", "asc"));
        break;
      case 'title_desc':
        q = query(q, orderBy("title", "desc"));
        break;
      case 'stock_shelves_desc':
        q = query(q, orderBy("stock_shelves", "desc"));
        break;
      case 'stock_storage_desc':
        q = query(q, orderBy("stock_storage", "desc"));
        break;
      case 'added_at_desc':
      default:
        q = query(q, orderBy("added_at", "desc"));
        break;
    }

    if (lastVisible) {
      q = query(q, startAfter(lastVisible));
    }
    q = query(q, firestoreLimit(limit));
  }

  try {
    const querySnapshot = await getDocs(q);
    let records = querySnapshot.docs.map(docSnap => processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }));

    if (isSearching) {
      const term = searchTerm!.toLowerCase().trim();

      // 1. Filter by search term
      records = records.filter(record =>
        record.title?.toLowerCase().includes(term) ||
        record.artist?.toLowerCase().includes(term) ||
        (record.barcode && record.barcode.toLowerCase().includes(term)) ||
        (record.label && record.label.toLowerCase().includes(term)) ||
        (Array.isArray(record.shelf_locations) && record.shelf_locations.some(loc => loc.toLowerCase().includes(term))) ||
        (Array.isArray(record.storage_locations) && record.storage_locations.some(loc => loc.toLowerCase().includes(term)))
      );

      // 2. Apply user's active filters in memory
      if (filters.year) records = records.filter(r => r.year === Number(filters.year));
      if (filters.genre) records = records.filter(r => Array.isArray(r.genre) && r.genre.includes(filters.genre!));
      if (filters.format) records = records.filter(r => r.formatDetails === filters.format);
      if (filters.condition) records = records.filter(r => r.media_condition === filters.condition);
      if (filters.location) records = records.filter(r =>
        (Array.isArray(r.shelf_locations) && r.shelf_locations.includes(filters.location!)) ||
        (Array.isArray(r.storage_locations) && r.storage_locations.includes(filters.location!))
      );

      // 3. Apply sort in memory
      records.sort((a, b) => {
        switch (sortOption) {
          case 'title_asc': return (a.title || '').localeCompare(b.title || '');
          case 'title_desc': return (b.title || '').localeCompare(a.title || '');
          case 'stock_shelves_desc': return (b.stock_shelves || 0) - (a.stock_shelves || 0);
          case 'stock_storage_desc': return (b.stock_storage || 0) - (a.stock_storage || 0);
          case 'added_at_desc':
          default: return (b.added_at || '').localeCompare(a.added_at || '');
        }
      });

      return { records, lastVisible: null };
    }

    const newLastVisible = querySnapshot.docs[querySnapshot.docs.length - 1] || null;
    return { records, lastVisible: newLastVisible };
  } catch (error) {
    console.error(`RecordService: Error fetching inventory records for distributor ${targetDistributorId} from Firestore:`, error);
    throw error;
  }
}

export async function getLatestRecordsFromDistributors(distributorIds: string[], count: number): Promise<VinylRecord[]> {
  if (!distributorIds || distributorIds.length === 0) {
    return [];
  }
  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  try {
    const q = query(
      recordsCollectionRef,
      where("distributorId", "in", distributorIds),
      where("isInventoryItem", "==", true),
      orderBy("added_at", "desc"),
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(docSnap => processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }));
    return records;
  } catch (error) {
    console.error(`RecordService: Error fetching latest records for distributors:`, error);
    throw error;
  }
}


export async function getLatestInventoryRecords(user: User, count: number): Promise<VinylRecord[]> {
  const targetDistributorId = user.distributorId;
  if (!targetDistributorId) {
    console.error("RecordService: Distributor ID is missing, cannot fetch latest inventory.");
    return [];
  }
  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  try {
    const q = query(
      recordsCollectionRef,
      where("distributorId", "==", targetDistributorId),
      where("isInventoryItem", "==", true),
      orderBy("added_at", "desc"),
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(docSnap => processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }));
    return records;
  } catch (error) {
    console.error(`RecordService: Error fetching latest inventory records for distributor ${targetDistributorId}:`, error);
    throw error;
  }
}

export async function getRecordsByDistributorId(distributorId: string): Promise<VinylRecord[]> {
  if (!distributorId) return [];
  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  try {
    const q = query(recordsCollectionRef, where("distributorId", "==", distributorId));
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(docSnap => processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }));
    return records;
  } catch (error) {
    console.error(`RecordService: Error fetching records for distributor ${distributorId}:`, error);
    throw error;
  }
}

export async function getInventoryBarcodes(user: User, distributorId?: string | null): Promise<string[]> {
    const targetDistributorId = distributorId || user.distributorId;
    if (!targetDistributorId) return [];
    try {
        const inventoryRecords = await getAllInventoryRecords(user, targetDistributorId);
        const barcodes = inventoryRecords
            .map(record => record.barcode)
            .filter((barcode): barcode is string => !!barcode);
        return barcodes;
    } catch (error) {
        console.error("RecordService: Failed to get inventory barcodes:", error);
        return [];
    }
}

export async function getUniqueLocations(user: User): Promise<{ shelfLocations: string[], storageLocations: string[] }> {
  if (!user.distributorId) return { shelfLocations: [], storageLocations: [] };
  
  try {
    const [distributor, recordsSnapshot] = await Promise.all([
      getDistributorById(user.distributorId),
      getDocs(query(collection(db, RECORDS_COLLECTION), where("distributorId", "==", user.distributorId), where("isInventoryItem", "==", true)))
    ]);

    const shelfLocations = new Set<string>(distributor?.shelfLocations || []);
    const storageLocations = new Set<string>(distributor?.storageLocations || []);

    recordsSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.shelf_locations && Array.isArray(data.shelf_locations)) {
            data.shelf_locations.forEach((loc: string) => loc && shelfLocations.add(loc.trim()));
        }
        if (data.storage_locations && Array.isArray(data.storage_locations)) {
            data.storage_locations.forEach((loc: string) => loc && storageLocations.add(loc.trim()));
        }
    });
    return {
      shelfLocations: Array.from(shelfLocations).sort((a,b) => a.localeCompare(b)),
      storageLocations: Array.from(storageLocations).sort((a,b) => a.localeCompare(b)),
    };
  } catch (error) {
    console.error("RecordService: Error fetching unique locations:", error);
    return { shelfLocations: [], storageLocations: [] };
  }
}

export async function getWishlistedRecords(user: User): Promise<VinylRecord[]> {
  if (!user.distributorId) return [];
  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  try {
    const q = query(
        recordsCollectionRef,
        where("distributorId", "==", user.distributorId),
        where("isWishlist", "==", true)
    );
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(docSnap => processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }));
    return records;
  } catch (error) {
    console.error("RecordService: Error fetching wishlisted records from Firestore:", error);
    throw error;
  }
}


export async function getRecordsByOwner(ownerUid: string, distributorId?: string | null): Promise<VinylRecord[]> {
  if (!ownerUid) return [];
  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  try {
    const q = query(recordsCollectionRef, where("ownerUid", "==", ownerUid));
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(docSnap => processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }));
    return records;
  } catch (error) {
    console.error(`RecordService: Error fetching records for owner ${ownerUid}:`, error);
    throw error;
  }
}

export async function getRecordsBySupplierId(supplierId: string, distributorId: string): Promise<VinylRecord[]> {
  if (!supplierId || !distributorId) {
    return [];
  }
  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  try {
    const q = query(
      recordsCollectionRef,
      where("distributorId", "==", distributorId),
      where("supplierId", "==", supplierId)
    );
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(docSnap => processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }));
    return records;
  } catch (error) {
    console.error(`RecordService: Error fetching records for supplier ${supplierId}:`, error);
    throw error;
  }
}

export async function getRecordsByArtist(artist: string, distributorId: string): Promise<VinylRecord[]> {
  if (!artist || !distributorId) return [];
  try {
    const q = query(
      collection(db, RECORDS_COLLECTION),
      where('artist', '==', artist),
      where('distributorId', '==', distributorId),
      where('isInventoryItem', '==', true)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => processRecordTimestamps({ ...d.data(), id: d.id }));
  } catch (error) {
    console.error(`RecordService: Error fetching records for artist "${artist}":`, error);
    return [];
  }
}

export async function getDistinctArtists(distributorId: string): Promise<string[]> {
  if (!distributorId) return [];
  try {
    const q = query(
      collection(db, RECORDS_COLLECTION),
      where('distributorId', '==', distributorId),
      where('isInventoryItem', '==', true)
    );
    const snapshot = await getDocs(q);
    const artists = new Set<string>();
    snapshot.docs.forEach(d => {
      const artist = d.data().artist;
      if (artist) artists.add(artist);
    });
    return Array.from(artists).sort();
  } catch (error) {
    console.error('RecordService: Error fetching distinct artists:', error);
    return [];
  }
}

export async function getRecordById(id: string): Promise<VinylRecord | undefined> {
  if (!id) return undefined;
  const recordDocRef = doc(db, RECORDS_COLLECTION, id);
  try {
    const docSnap = await getDoc(recordDocRef);
    if (docSnap.exists()) {
      return processRecordTimestamps({ ...docSnap.data(), id: docSnap.id });
    }
    return undefined;
  } catch (error) {
    console.error(`RecordService: Error fetching record ${id} from Firestore:`, error);
    throw error;
  }
}

export async function getRecordByBarcode(barcode: string, user: User, distributorId?: string | null): Promise<VinylRecord | null> {
  const targetDistributorId = distributorId || user.distributorId;
  if (!barcode || !targetDistributorId) return null;
  const normalizedBarcode = barcode.replace(/[\s-]/g, '');

  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  const q = query(
    recordsCollectionRef, 
    where("distributorId", "==", targetDistributorId),
    where("barcode", "==", normalizedBarcode), 
    where("isInventoryItem", "==", true), 
    firestoreLimit(1)
  );

  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }) as VinylRecord;
    }
    return null;
  } catch (error) {
    console.error(`RecordService: Error fetching inventory record by barcode "${normalizedBarcode}":`, error);
    throw error;
  }
}

export async function addRecord(
  recordData: Omit<VinylRecord, 'id' | 'added_at' | 'last_modified_at' | 'added_by_email' | 'last_modified_by_email' | 'ownerUid' | 'distributorId'>,
  actingUser: User
): Promise<VinylRecord> {
    const targetDistributorId = actingUser.distributorId;
    if (!actingUser || !actingUser.uid || !actingUser.email || !targetDistributorId) {
        throw new Error("User context (UID, email, distributorId) is required to add a record.");
    }
    
    const now = new Date();
    const isInventory = actingUser.role !== 'viewer';

    const dataToSave = {
        ...recordData,
        barcode: recordData.barcode ? recordData.barcode.replace(/[\s-]/g, '') : undefined,
        distributorId: targetDistributorId,
        ownerUid: actingUser.uid,
        isInventoryItem: isInventory,
        isForSale: isInventory ? recordData.isForSale ?? true : false,
        added_at: Timestamp.fromDate(now),
        last_modified_at: Timestamp.fromDate(now),
        added_by_email: actingUser.email,
        last_modified_by_email: actingUser.email,
    };

    const dataToSaveCleaned = cleanDataForFirestore(dataToSave);
    
    try {
        const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
        const docRef = await addDoc(recordsCollectionRef, dataToSaveCleaned);
        const newDocSnap = await getDoc(docRef);
        
        if (newDocSnap.exists()) {
            const newRecord = processRecordTimestamps({ ...newDocSnap.data(), id: newDocSnap.id });
            
            if (actingUser.role === 'master') {
              try {
                  const newShelfLocations = recordData.shelf_locations || [];
                  const newStorageLocations = recordData.storage_locations || [];

                  if ((newShelfLocations.length > 0 || newStorageLocations.length > 0) && actingUser.distributorId) {
                      const distributorDocRef = doc(db, 'distributors', actingUser.distributorId);
                      const distributorSnap = await getDoc(distributorDocRef);

                      if (distributorSnap.exists()) {
                          const distributorData = distributorSnap.data() as Distributor;
                          const currentShelfLocations = new Set(distributorData.shelfLocations || []);
                          const currentStorageLocations = new Set(distributorData.storageLocations || []);
                          let needsUpdate = false;
                          
                          newShelfLocations.forEach(loc => {
                            if (!currentShelfLocations.has(loc)) {
                                currentShelfLocations.add(loc);
                                needsUpdate = true;
                            }
                          });

                          newStorageLocations.forEach(loc => {
                            if (!currentStorageLocations.has(loc)) {
                                currentStorageLocations.add(loc);
                                needsUpdate = true;
                            }
                          });

                          if (needsUpdate) {
                              await updateDoc(distributorDocRef, {
                                  shelfLocations: Array.from(currentShelfLocations),
                                  storageLocations: Array.from(currentStorageLocations)
                              });
                          }
                      }
                  }
              } catch (error) {
                  console.warn("RecordService: Could not update distributor with new locations.", error);
              }
            }
            
            if (newRecord.isInventoryItem) {
                await handleLowStockNotification(newRecord, actingUser);
            }
            return newRecord;
        }
        throw new Error("Failed to retrieve newly added record");
    } catch (error) {
        console.error("RecordService: Error adding record to Firestore:", error);
        throw error;
    }
}

export async function batchUpdateRecords(
  records: Pick<VinylRecord, 'id' | 'stock_shelves' | 'shelf_locations' | 'stock_storage' | 'storage_locations'>[],
  actingUser: User
): Promise<void> {
  if (!actingUser.email) {
    throw new Error("User email is required for auditing batch updates.");
  }
  const now = Timestamp.now();
  const batch = writeBatch(db);

  records.forEach(record => {
    const docRef = doc(db, RECORDS_COLLECTION, record.id);
    const updateData = {
      stock_shelves: Number(record.stock_shelves) || 0,
      shelf_locations: record.shelf_locations || [],
      stock_storage: Number(record.stock_storage) || 0,
      storage_locations: record.storage_locations || [],
      last_modified_at: now,
      last_modified_by_email: actingUser.email,
    };
    batch.update(docRef, updateData);
  });

  try {
    await batch.commit();
    // After committing, trigger low stock notifications for all modified records
    for (const record of records) {
        const fullRecord = await getRecordById(record.id);
        if (fullRecord) {
            await handleLowStockNotification(fullRecord, actingUser);
        }
    }
  } catch (error) {
    console.error("RecordService: Error batch updating records:", error);
    throw error;
  }
}


export async function updateRecord(
  id: string,
  updatedData: Partial<Omit<VinylRecord, 'id' | 'added_at' | 'added_by_email'| 'last_modified_at' | 'last_modified_by_email'>>,
  actingUser: User
): Promise<VinylRecord | undefined> {
   if (!actingUser.email) {
    throw new Error("User email is required to update a record for auditing purposes.");
  }
  const now = new Date();
  const recordDocRef = doc(db, RECORDS_COLLECTION, id);

  try {
    const oldDocSnap = await getDoc(recordDocRef);
    if (!oldDocSnap.exists()) {
      throw new Error("Record to update does not exist.");
    }
    const oldData = oldDocSnap.data() as VinylRecord;

    const actingUserDistributorId = actingUser.distributorId;
    if (actingUser.role !== 'superadmin' && oldData.distributorId !== actingUserDistributorId && oldData.ownerUid !== actingUser.uid) {
        throw new Error("Permission Denied: You cannot edit this record.");
    }

    const dataWithNormalizedBarcode = {
      ...updatedData,
      barcode: updatedData.barcode ? updatedData.barcode.replace(/[\s-]/g, '') : updatedData.barcode,
    };

    const dataToUpdateCleaned = cleanDataForFirestore({
      ...dataWithNormalizedBarcode,
      last_modified_at: Timestamp.fromDate(now),
      last_modified_by_email: actingUser.email,
    });
    
    delete (dataToUpdateCleaned as any).added_at;
    delete (dataToUpdateCleaned as any).added_by_email;
    delete (dataToUpdateCleaned as any).ownerUid;
    delete (dataToUpdateCleaned as any).isInventoryItem;
    delete (dataToUpdateCleaned as any).distributorId;

    const finalDataToUpdate: Record<string, any> = {};
    for(const key in dataToUpdateCleaned) {
        const typedKey = key as keyof typeof dataToUpdateCleaned;
        if(dataToUpdateCleaned[typedKey] !== undefined) {
          finalDataToUpdate[typedKey] = dataToUpdateCleaned[typedKey];
        }
    }

    await updateDoc(recordDocRef, finalDataToUpdate);
    const updatedDocSnap = await getDoc(recordDocRef);

    if (updatedDocSnap.exists()) {
        const updatedRecord = processRecordTimestamps({ ...updatedDocSnap.data(), id: updatedDocSnap.id });
        
        if (actingUser.role === 'master') {
          try {
              const newShelfLocations = updatedData.shelf_locations || [];
              const newStorageLocations = updatedData.storage_locations || [];
              const distributorId = updatedRecord.distributorId;

              if ((newShelfLocations.length > 0 || newStorageLocations.length > 0) && distributorId) {
                  const distributorDocRef = doc(db, 'distributors', distributorId);
                  const distributorSnap = await getDoc(distributorDocRef);

                  if (distributorSnap.exists()) {
                      const distributorData = distributorSnap.data() as Distributor;
                      const currentShelfLocations = new Set(distributorData.shelfLocations || []);
                      const currentStorageLocations = new Set(distributorData.storageLocations || []);
                      let needsUpdate = false;
                      
                      newShelfLocations.forEach(loc => {
                        if (!currentShelfLocations.has(loc)) {
                            currentShelfLocations.add(loc);
                            needsUpdate = true;
                        }
                      });

                      newStorageLocations.forEach(loc => {
                        if (!currentStorageLocations.has(loc)) {
                            currentStorageLocations.add(loc);
                            needsUpdate = true;
                        }
                      });

                      if (needsUpdate) {
                          await updateDoc(distributorDocRef, {
                              shelfLocations: Array.from(currentShelfLocations),
                              storageLocations: Array.from(currentStorageLocations)
                          });
                      }
                  }
              }
          } catch (error) {
              console.warn("RecordService: Could not update distributor with new locations during record update.", error);
          }
        }

        if (updatedRecord.isInventoryItem) {
            await handleLowStockNotification(updatedRecord, actingUser);
        }
        return updatedRecord;
    }
    return undefined;
  } catch (error) {
    console.error(`RecordService: Error updating record ${id} in Firestore:`, error);
    throw error;
  }
}

export async function deleteRecord(id: string): Promise<boolean> {
  const recordDocRef = doc(db, RECORDS_COLLECTION, id);
  try {
    await deleteDoc(recordDocRef);
    return true;
  } catch (error) {
    console.error(`RecordService: Error deleting record ${id} from Firestore:`, error);
    throw error;
  }
}

// Available-for-sale = total physical stock minus reserved by open orders.
export function getAvailableStock(record: Pick<VinylRecord, 'stock_shelves' | 'stock_storage' | 'reserved'> | undefined | null): number {
  if (!record) return 0;
  const total = (record.stock_shelves || 0) + (record.stock_storage || 0);
  const reserved = record.reserved || 0;
  return Math.max(0, total - reserved);
}

// Collapse items that reference the same recordId into a single entry with
// summed quantity. Each stock op below runs one Firestore transaction per
// recordId, so if the order accidentally lists the same record twice the
// transactions would race against each other on the same doc. Callers must
// pass the coalesced list.
function coalesceByRecordId<T extends { recordId: string; quantity: number; title?: string }>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    if (!item.recordId || !item.quantity || item.quantity <= 0) continue;
    const existing = byId.get(item.recordId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      byId.set(item.recordId, { ...item });
    }
  }
  return Array.from(byId.values());
}

/**
 * Reserves stock for each item in one Firestore transaction per record. Holds
 * the quantity via `reserved` so it counts against visible availability without
 * touching the physical stock_shelves / stock_storage counts. Throws if any
 * item would over-reserve — the caller should then bail the whole order.
 */
export async function reserveStockForOrder(items: OrderItem[], distributorId: string): Promise<void> {
  const unique = coalesceByRecordId(items);
  for (const item of unique) {
    const recordRef = doc(db, RECORDS_COLLECTION, item.recordId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(recordRef);
      if (!snap.exists()) {
        throw new Error(`Record "${item.title}" not found.`);
      }
      const data = snap.data() as VinylRecord;
      if (data.distributorId !== distributorId) {
        throw new Error(`Record "${item.title}" does not belong to this distributor.`);
      }
      const total = (data.stock_shelves || 0) + (data.stock_storage || 0);
      const currentReserved = data.reserved || 0;
      const availableForReservation = total - currentReserved;
      if (availableForReservation < item.quantity) {
        throw new Error(`Insufficient stock for "${data.title}". Available: ${availableForReservation}, requested: ${item.quantity}.`);
      }
      tx.update(recordRef, { reserved: currentReserved + item.quantity });
    });
  }
}

/**
 * Releases a prior reservation (e.g. order cancelled before payment). Clamps
 * at zero so repeated calls don't underflow — intended to be idempotent.
 */
export async function releaseStockForOrder(items: OrderItem[]): Promise<void> {
  const unique = coalesceByRecordId(items);
  for (const item of unique) {
    const recordRef = doc(db, RECORDS_COLLECTION, item.recordId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(recordRef);
        if (!snap.exists()) return;
        const data = snap.data() as VinylRecord;
        const currentReserved = data.reserved || 0;
        const nextReserved = Math.max(0, currentReserved - item.quantity);
        tx.update(recordRef, { reserved: nextReserved });
      });
    } catch (err) {
      console.warn(`Failed to release reservation for record ${item.recordId}:`, err);
    }
  }
}

/**
 * Converts an existing reservation into a real stock deduction (order paid).
 * Atomic per record: decrements `reserved`, then decrements physical stock
 * (shelves first, fall back to storage). Written in a single transaction so
 * the invariant "reserved never exceeds physical stock" is preserved even
 * under concurrent deductions.
 */
export async function deductReservedStockForOrder(items: OrderItem[], actingUserEmail?: string | null): Promise<void> {
  const unique = coalesceByRecordId(items);
  for (const item of unique) {
    const recordRef = doc(db, RECORDS_COLLECTION, item.recordId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(recordRef);
      if (!snap.exists()) return;
      const data = snap.data() as VinylRecord;

      let qty = item.quantity;
      let shelf = data.stock_shelves || 0;
      let storage = data.stock_storage || 0;

      const fromShelves = Math.min(qty, shelf);
      shelf -= fromShelves;
      qty -= fromShelves;
      if (qty > 0) {
        const fromStorage = Math.min(qty, storage);
        storage -= fromStorage;
        qty -= fromStorage;
      }
      // If qty > 0 here the physical stock is insufficient — this can happen
      // legitimately if the record was edited after reservation. Clamp and log
      // rather than throw, because the customer already paid and we shouldn't
      // fail the webhook.
      if (qty > 0) {
        console.warn(`[deductReservedStock] Physical stock underran for record ${item.recordId} by ${qty}. Distributor should reconcile.`);
      }

      const newReserved = Math.max(0, (data.reserved || 0) - item.quantity);

      tx.update(recordRef, {
        stock_shelves: shelf,
        stock_storage: storage,
        reserved: newReserved,
        last_modified_at: new Date().toISOString(),
        ...(actingUserEmail ? { last_modified_by_email: actingUserEmail } : {}),
      });
    });
  }
}

/**
 * Deducts physical stock directly without prior reservation. Used for legacy
 * orders that were created before the reservation flow existed, or orders
 * that were reactivated from a non-reserved state. Atomic per record.
 */
export async function deductStockForOrder(items: OrderItem[], distributorId: string, actingUser: User): Promise<void> {
  const unique = coalesceByRecordId(items);
  for (const item of unique) {
    const recordRef = doc(db, RECORDS_COLLECTION, item.recordId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(recordRef);
      if (!snap.exists()) {
        throw new Error(`Record "${item.title}" not found.`);
      }
      const data = snap.data() as VinylRecord;
      if (data.distributorId !== distributorId) {
        throw new Error(`Record "${item.title}" does not belong to this distributor.`);
      }
      const total = (data.stock_shelves || 0) + (data.stock_storage || 0);
      if (total < item.quantity) {
        throw new Error(`Insufficient stock for "${data.title}". Available: ${total}, requested: ${item.quantity}.`);
      }

      let qty = item.quantity;
      let shelf = data.stock_shelves || 0;
      let storage = data.stock_storage || 0;

      const fromShelves = Math.min(qty, shelf);
      shelf -= fromShelves;
      qty -= fromShelves;
      if (qty > 0) {
        storage -= qty;
      }

      tx.update(recordRef, {
        stock_shelves: shelf,
        stock_storage: storage,
        last_modified_at: new Date().toISOString(),
        last_modified_by_email: actingUser.email || null,
      });
    });
  }
}

/**
 * Restores previously-deducted stock (refund of a paid order). Adds back to
 * storage so the distributor can decide where to put it physically.
 */
export async function restoreStockForOrder(items: OrderItem[], actingUser: User): Promise<void> {
  const unique = coalesceByRecordId(items);
  for (const item of unique) {
    const recordRef = doc(db, RECORDS_COLLECTION, item.recordId);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(recordRef);
        if (!snap.exists()) return;
        const data = snap.data() as VinylRecord;
        tx.update(recordRef, {
          stock_storage: (data.stock_storage || 0) + item.quantity,
          last_modified_at: new Date().toISOString(),
          last_modified_by_email: actingUser.email || null,
        });
      });
    } catch (err) {
      console.warn(`Could not restore stock for record ID ${item.recordId}:`, err);
    }
  }
}

// Simple stock update for quick adjustments (no auth required for validation)
export async function updateRecordStock(
    recordId: string,
    type: 'shelf' | 'storage',
    delta: number
): Promise<void> {
    const record = await getRecordById(recordId);
    if (!record) {
        throw new Error("Record not found.");
    }

    const currentStock = type === 'shelf'
        ? Number(record.stock_shelves || 0)
        : Number(record.stock_storage || 0);

    const newStock = currentStock + delta;
    if (newStock < 0) {
        throw new Error("Stock cannot be negative.");
    }

    const updateField = type === 'shelf' ? 'stock_shelves' : 'stock_storage';
    const recordRef = doc(db, RECORDS_COLLECTION, recordId);
    await updateDoc(recordRef, { [updateField]: newStock });
}

export async function adjustStock(
    recordId: string,
    adjustments: { shelves: number; storage: number, shelf_locations: string[], storage_locations: string[] },
    actingUser: User
): Promise<VinylRecord | undefined> {
    const record = await getRecordById(recordId);
    if (!record) {
        throw new Error("Record not found.");
    }

    const currentShelves = Number(record.stock_shelves || 0);
    const currentStorage = Number(record.stock_storage || 0);

    const newShelves = currentShelves + adjustments.shelves;
    const newStorage = currentStorage + adjustments.storage;

    if (newShelves < 0 || newStorage < 0) {
        throw new Error("Stock cannot be adjusted to a negative value.");
    }
    
    return updateRecord(recordId, {
        stock_shelves: newShelves,
        stock_storage: newStorage,
        shelf_locations: adjustments.shelf_locations,
        storage_locations: adjustments.storage_locations,
    }, actingUser);
}

export async function getWishlistRecord(userId: string, discogsId: number): Promise<VinylRecord | null> {
  if (!userId || !discogsId) return null;

  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  const q = query(
    recordsCollectionRef, 
    where("ownerUid", "==", userId),
    where("isWishlist", "==", true),
    where("discogs_id", "==", discogsId),
    firestoreLimit(1)
  );

  try {
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }) as VinylRecord;
    }
    return null;
  } catch (error) {
    console.error(`RecordService: Error fetching wishlist item for user "${userId}" and discogs_id "${discogsId}":`, error);
    throw error;
  }
}

// This function is for fetching ALL records for the admin stats page
export async function getAllRecords(): Promise<VinylRecord[]> {
  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  try {
    const querySnapshot = await getDocs(recordsCollectionRef);
    const records = querySnapshot.docs.map(docSnap => processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }));
    return records;
  } catch (error) {
    console.error(`RecordService: Error fetching all records:`, error);
    throw error;
  }
}

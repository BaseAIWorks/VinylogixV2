
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
  }
): Promise<{ records: VinylRecord[], lastVisible: DocumentSnapshot | null }> {
  const { distributorId, filters = {}, sortOption = 'added_at_desc', limit = 25, lastVisible } = options;
  const targetDistributorId = user.role === 'viewer' ? distributorId : user.distributorId;

  if (!targetDistributorId) {
    if (user.role === 'viewer') return { records: [], lastVisible: null };
    throw new Error("Missing or insufficient permissions.");
  }

  const recordsCollectionRef = collection(db, RECORDS_COLLECTION);
  let q: Query<DocumentData> = query(
    recordsCollectionRef,
    where("distributorId", "==", targetDistributorId),
    where("isInventoryItem", "==", true)
  );

  // Apply filters
  if (filters.year) q = query(q, where("year", "==", Number(filters.year)));
  if (filters.genre) q = query(q, where("genre", "array-contains", filters.genre));
  if (filters.format) q = query(q, where("formatDetails", "==", filters.format));
  if (filters.condition) q = query(q, where("media_condition", "==", filters.condition));
  if (filters.location) q = query(q, where("shelf_locations", "array-contains", filters.location));

  // Apply sorting
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

  // Apply pagination
  if (lastVisible) {
    q = query(q, startAfter(lastVisible));
  }
  
  q = query(q, firestoreLimit(limit));

  try {
    const querySnapshot = await getDocs(q);
    const records = querySnapshot.docs.map(docSnap => processRecordTimestamps({ ...docSnap.data(), id: docSnap.id }));
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

async function checkStockAvailability(items: OrderItem[], distributorId: string): Promise<void> {
  for (const item of items) {
    const record = await getRecordById(item.recordId);
    if (!record || record.distributorId !== distributorId) {
      throw new Error(`Record "${item.title}" not found in this distributor's inventory.`);
    }
    const totalStock = (record.stock_shelves || 0) + (record.stock_storage || 0);
    if (totalStock < item.quantity) {
      throw new Error(`Insufficient stock for "${record.title}". Available: ${totalStock}, Requested: ${item.quantity}.`);
    }
  }
}


export async function deductStockForOrder(items: OrderItem[], distributorId: string, actingUser: User): Promise<void> {
  await checkStockAvailability(items, distributorId);

  for (const item of items) {
    const record = await getRecordById(item.recordId);
    if (record) {
      let quantityToDeduct = item.quantity;
      let shelfStock = record.stock_shelves || 0;
      let storageStock = record.stock_storage || 0;

      const fromShelves = Math.min(quantityToDeduct, shelfStock);
      shelfStock -= fromShelves;
      quantityToDeduct -= fromShelves;

      if (quantityToDeduct > 0) {
        storageStock -= quantityToDeduct;
      }

      await updateRecord(record.id, {
        stock_shelves: shelfStock,
        stock_storage: storageStock
      }, actingUser);
    }
  }
}

export async function restoreStockForOrder(items: OrderItem[], actingUser: User): Promise<void> {
  for (const item of items) {
    const record = await getRecordById(item.recordId);
    if (record) {
      const newStorageStock = (record.stock_storage || 0) + item.quantity;
      await updateRecord(record.id, {
        stock_storage: newStorageStock
      }, actingUser);
    } else {
      console.warn(`Could not restore stock for record ID ${item.recordId} as it was not found.`);
    }
  }
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

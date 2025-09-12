

import type { Supplier, User } from '@/types';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  orderBy,
} from 'firebase/firestore';

const DISTRIBUTORS_COLLECTION = 'distributors';
const SUPPLIERS_SUBCOLLECTION = 'suppliers';

const processSupplierTimestamps = (supplierData: any): Supplier => {
  const processed = { ...supplierData };
  if (processed.createdAt && processed.createdAt instanceof Timestamp) {
    processed.createdAt = processed.createdAt.toDate().toISOString();
  }
  return processed as Supplier;
};

export async function getSuppliersByDistributorId(distributorId: string): Promise<Supplier[]> {
  if (!distributorId) {
    return [];
  }
  // Query the subcollection within the distributor document
  const suppliersSubcollectionRef = collection(db, DISTRIBUTORS_COLLECTION, distributorId, SUPPLIERS_SUBCOLLECTION);
  try {
    const q = query(suppliersSubcollectionRef, orderBy("name", "asc"));
    const querySnapshot = await getDocs(q);
    const suppliers = querySnapshot.docs.map(docSnap => 
      processSupplierTimestamps({ ...docSnap.data(), id: docSnap.id })
    );
    return suppliers;
  } catch (error) {
    console.error(`SupplierService: Error fetching suppliers for distributor ${distributorId}:`, error);
    throw error;
  }
}

export async function addSupplier(
  supplierData: Omit<Supplier, 'id' | 'createdAt' | 'distributorId'>,
  actingUser: User,
): Promise<Supplier> {
  if (!actingUser.distributorId) {
    throw new Error("User must be associated with a distributor to add a supplier.");
  }
  const now = new Date();
  // The distributorId is no longer needed inside the document itself, as it's part of the path.
  const dataToSave = {
    ...supplierData,
    createdAt: Timestamp.fromDate(now),
  };

  try {
    // Add to the subcollection
    const suppliersSubcollectionRef = collection(db, DISTRIBUTORS_COLLECTION, actingUser.distributorId, SUPPLIERS_SUBCOLLECTION);
    const docRef = await addDoc(suppliersSubcollectionRef, dataToSave);
    const newDocSnap = await getDoc(docRef);
    if (newDocSnap.exists()) {
      return processSupplierTimestamps({ ...newDocSnap.data(), id: newDocSnap.id });
    }
    throw new Error("Failed to retrieve newly added supplier");
  } catch (error) {
    console.error("SupplierService: Error adding supplier to Firestore:", error);
    throw error;
  }
}

export async function updateSupplier(
  distributorId: string, // Now required to build the correct path
  supplierId: string,
  updatedData: Partial<Omit<Supplier, 'id' | 'createdAt' | 'distributorId'>>,
): Promise<Supplier | null> {
  // Get reference to the document in the subcollection
  const supplierDocRef = doc(db, DISTRIBUTORS_COLLECTION, distributorId, SUPPLIERS_SUBCOLLECTION, supplierId);
  try {
    await updateDoc(supplierDocRef, updatedData);
    const updatedDocSnap = await getDoc(supplierDocRef);
    if (updatedDocSnap.exists()) {
      return processSupplierTimestamps({ ...updatedDocSnap.data(), id: updatedDocSnap.id });
    }
    return null;
  } catch (error) {
    console.error(`SupplierService: Error updating supplier ${supplierId}:`, error);
    throw error;
  }
}

export async function deleteSupplier(distributorId: string, supplierId: string): Promise<boolean> {
  // Get reference to the document in the subcollection
  const supplierDocRef = doc(db, DISTRIBUTORS_COLLECTION, distributorId, SUPPLIERS_SUBCOLLECTION, supplierId);
  try {
    await deleteDoc(supplierDocRef);
    return true;
  } catch (error) {
    console.error(`SupplierService: Error deleting supplier ${supplierId}:`, error);
    throw error;
  }
}

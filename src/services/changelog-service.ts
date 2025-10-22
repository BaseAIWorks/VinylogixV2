
"use client";

import type { ChangelogEntry } from '@/types';
import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  query,
  orderBy
} from 'firebase/firestore';

const CHANGELOG_COLLECTION = 'changelog';

const processChangelogTimestamps = (entryData: any): ChangelogEntry => {
  const processed = { ...entryData };
  if (processed.date && processed.date instanceof Timestamp) {
    processed.date = processed.date.toDate().toISOString();
  }
  return processed as ChangelogEntry;
};

export async function getChangelogs(): Promise<ChangelogEntry[]> {
  const changelogCollectionRef = collection(db, CHANGELOG_COLLECTION);
  try {
    const q = query(changelogCollectionRef, orderBy("date", "desc"));
    const querySnapshot = await getDocs(q);
    const entries = querySnapshot.docs.map(docSnap => 
      processChangelogTimestamps({ ...docSnap.data(), id: docSnap.id })
    );
    return entries;
  } catch (error) {
    console.error("ChangelogService: Error fetching changelog entries:", error);
    throw error;
  }
}

export async function addChangelog(
  entryData: Omit<ChangelogEntry, 'id' | 'date'>
): Promise<ChangelogEntry> {
  const now = new Date();
  const dataToSave = {
    ...entryData,
    date: Timestamp.fromDate(now),
  };

  try {
    const changelogCollectionRef = collection(db, CHANGELOG_COLLECTION);
    const docRef = await addDoc(changelogCollectionRef, dataToSave);
    const newDocSnap = await getDoc(docRef);
    if (newDocSnap.exists()) {
      return processChangelogTimestamps({ ...newDocSnap.data(), id: newDocSnap.id });
    }
    throw new Error("Failed to retrieve newly added changelog entry");
  } catch (error) {
    console.error("ChangelogService: Error adding entry to Firestore:", error);
    throw error;
  }
}

export async function updateChangelog(
  id: string,
  updatedData: Partial<Omit<ChangelogEntry, 'id' | 'date'>>,
): Promise<ChangelogEntry | null> {
  const changelogDocRef = doc(db, CHANGELOG_COLLECTION, id);
  try {
    await updateDoc(changelogDocRef, {
        ...updatedData,
        date: Timestamp.now(), // Always update the date on edit
    });
    const updatedDocSnap = await getDoc(changelogDocRef);
    if (updatedDocSnap.exists()) {
      return processChangelogTimestamps({ ...updatedDocSnap.data(), id: updatedDocSnap.id });
    }
    return null;
  } catch (error) {
    console.error(`ChangelogService: Error updating entry ${id}:`, error);
    throw error;
  }
}

export async function deleteChangelog(id: string): Promise<boolean> {
  const changelogDocRef = doc(db, CHANGELOG_COLLECTION, id);
  try {
    await deleteDoc(changelogDocRef);
    return true;
  } catch (error) {
    console.error(`ChangelogService: Error deleting entry ${id}:`, error);
    throw error;
  }
}

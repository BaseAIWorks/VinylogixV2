
"use client";

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { BrandingSettings } from '@/types';

const SETTINGS_COLLECTION = 'settings';
const BRANDING_DOC_ID = 'branding';

const defaultBranding: BrandingSettings = {
  companyName: 'Vinylogix',
  logoUrl: '/logo.png',
};

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const docRef = doc(db, SETTINGS_COLLECTION, BRANDING_DOC_ID);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      // Merge with defaults to ensure all fields are present
      return { ...defaultBranding, ...docSnap.data() } as BrandingSettings;
    }
    return defaultBranding;
  } catch (error) {
    console.error("Error fetching branding settings:", error);
    return defaultBranding;
  }
}

export async function updateBrandingSettings(data: Partial<BrandingSettings>): Promise<boolean> {
  const docRef = doc(db, SETTINGS_COLLECTION, BRANDING_DOC_ID);
  try {
    // Use setDoc with merge: true to create or update the document.
    await setDoc(docRef, data, { merge: true });
    return true;
  } catch (error) {
    console.error("Error updating branding settings:", error);
    return false;
  }
}

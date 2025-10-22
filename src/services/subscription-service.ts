
"use server"; // This is now a server-only module

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { SubscriptionInfo, SubscriptionTier, WeightOption } from '@/types';
import { db } from '@/lib/firebase'; // Keep client db for client functions if any were left

const SETTINGS_COLLECTION = 'settings';
const SUBSCRIPTION_TIERS_DOC_ID = 'subscriptionTiers';
const PLATFORM_SETTINGS_DOC_ID = 'platform';

const defaultTiers: Record<SubscriptionTier, SubscriptionInfo> = {
  essential: {
    tier: 'essential',
    status: 'trialing',
    maxRecords: 100,
    maxUsers: 2,
    allowOrders: false,
    allowAiFeatures: false,
    price: 9,
    quarterlyPrice: 25,
    yearlyPrice: 90,
    description: "For personal collectors and enthusiasts getting started.",
    features: "Up to 100 records\nPersonal collection tracking\nWishlist management",
  },
  growth: {
    tier: 'growth',
    status: 'active',
    maxRecords: 1000,
    maxUsers: 10,
    allowOrders: true,
    allowAiFeatures: false,
    price: 29,
    quarterlyPrice: 79,
    yearlyPrice: 290,
    description: "Ideal for small shops and growing businesses.",
    features: "Up to 1,000 records\nOrder Management\nClient Accounts\nBasic Analytics",
  },
  scale: {
    tier: 'scale',
    status: 'active',
    maxRecords: -1, // -1 for unlimited
    maxUsers: -1, // -1 for unlimited
    allowOrders: true,
    allowAiFeatures: true,
    price: 79,
    quarterlyPrice: 220,
    yearlyPrice: 790,
    description: "For established distributors and power users.",
    features: "Unlimited records\nAI-powered descriptions\nAdvanced Analytics\nPriority Support",
  },
};

export async function getSubscriptionTiersOnServer(): Promise<Record<SubscriptionTier, SubscriptionInfo>> {
  const adminDb = getAdminDb();
  if (!adminDb) {
    console.warn("Admin SDK not available. Falling back to default tiers on server.");
    return defaultTiers;
  }
  const docRef = adminDb.collection(SETTINGS_COLLECTION).doc(SUBSCRIPTION_TIERS_DOC_ID);
  try {
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const dbTiers = docSnap.data() as Partial<Record<SubscriptionTier, SubscriptionInfo>>;
      return {
        essential: { ...defaultTiers.essential, ...dbTiers.essential },
        growth: { ...defaultTiers.growth, ...dbTiers.growth },
        scale: { ...defaultTiers.scale, ...dbTiers.scale },
      };
    }
    return defaultTiers;
  } catch (error) {
    console.error("SubscriptionService [SERVER]: Error fetching subscription tiers:", error);
    return defaultTiers;
  }
}

// Client-side functions will be moved to a new file.
// The functions getSubscriptionTiers, updateSubscriptionTiers, getWeightOptions, updateWeightOptions
// will be moved to a new client-specific service file.

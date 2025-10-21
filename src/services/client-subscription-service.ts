
"use client"; 

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { SubscriptionInfo, SubscriptionTier, WeightOption } from '@/types';

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

const defaultWeightOptions: WeightOption[] = [
    { id: 'default_1', label: "Single LP (12\")", weight: 280, isFixed: true },
    { id: 'default_2', label: "Single LP (180g)", weight: 340, isFixed: true },
    { id: 'default_3', label: "Double LP (2x12\")", weight: 480, isFixed: true },
    { id: 'default_4', label: "7\" Single", weight: 120, isFixed: true },
    { id: 'default_5', label: "CD Album", weight: 100, isFixed: true },
];

export async function getSubscriptionTiers(): Promise<Record<SubscriptionTier, SubscriptionInfo>> {
    const docRef = doc(db, SETTINGS_COLLECTION, SUBSCRIPTION_TIERS_DOC_ID);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const dbTiers = docSnap.data() as Partial<Record<SubscriptionTier, SubscriptionInfo>>;
            const mergedTiers: Record<SubscriptionTier, SubscriptionInfo> = {
                essential: { ...defaultTiers.essential, ...dbTiers.essential },
                growth: { ...defaultTiers.growth, ...dbTiers.growth },
                scale: { ...defaultTiers.scale, ...dbTiers.scale },
            };
            return mergedTiers;
        } else {
            await setDoc(docRef, defaultTiers);
            return defaultTiers;
        }
    } catch (error) {
        console.error("ClientSubscriptionService: Error fetching subscription tiers:", error);
        return defaultTiers;
    }
}

export async function updateSubscriptionTiers(tiers: Record<SubscriptionTier, SubscriptionInfo>): Promise<boolean> {
  const docRef = doc(db, SETTINGS_COLLECTION, SUBSCRIPTION_TIERS_DOC_ID);
  try {
    await setDoc(docRef, tiers, { merge: true });
    return true;
  } catch (error) {
    console.error("ClientSubscriptionService: Error updating subscription tiers:", error);
    return false;
  }
}

export async function getWeightOptions(): Promise<WeightOption[]> {
    const docRef = doc(db, SETTINGS_COLLECTION, PLATFORM_SETTINGS_DOC_ID);
     try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && Array.isArray(data.weightOptions)) {
                return data.weightOptions.map((opt: any, index: number) => ({
                    ...opt,
                    id: opt.id || `db_opt_${index}_${new Date().getTime()}`
                }));
            }
            return [];
        } else {
            await setDoc(docRef, { weightOptions: defaultWeightOptions }, { merge: true });
            return defaultWeightOptions.map((opt, index) => ({
                ...opt,
                id: opt.id || `default_opt_${index}`
            }));
        }
    } catch (error) {
        console.error("ClientSubscriptionService: Error fetching weight options:", error);
        return defaultWeightOptions;
    }
}

export async function updateWeightOptions(options: WeightOption[]): Promise<boolean> {
  const docRef = doc(db, SETTINGS_COLLECTION, PLATFORM_SETTINGS_DOC_ID);
  try {
    await setDoc(docRef, { weightOptions: options }, { merge: true });
    return true;
  } catch (error) {
    console.error("ClientSubscriptionService: Error updating weight options:", error);
    return false;
  }
}

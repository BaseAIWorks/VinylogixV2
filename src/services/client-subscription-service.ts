
"use client";

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase';
import type { SubscriptionInfo, SubscriptionTier, WeightOption } from '@/types';

const SETTINGS_COLLECTION = 'settings';
const SUBSCRIPTION_TIERS_DOC_ID = 'subscriptionTiers';
const PLATFORM_SETTINGS_DOC_ID = 'platform';

const defaultTiers: Record<SubscriptionTier, SubscriptionInfo> = {
  payg: {
    tier: 'payg',
    status: 'active',
    maxRecords: 50,
    maxUsers: 1,
    allowOrders: true,
    allowAiFeatures: false,
    price: 0,
    quarterlyPrice: 0,
    yearlyPrice: 0,
    description: "Start selling with no monthly fee. Pay only when you sell.",
    features: "Order Management\nNo monthly commitment",
    isActive: true,
    transactionFeePercent: 6,
  },
  essential: {
    tier: 'essential',
    status: 'trialing',
    maxRecords: 100,
    maxUsers: 2,
    allowOrders: true,
    allowAiFeatures: false,
    price: 9,
    quarterlyPrice: 25,
    yearlyPrice: 90,
    description: "For personal collectors and enthusiasts getting started.",
    features: "Order Management\nClient Accounts",
    isActive: true,
    transactionFeePercent: 4,
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
    features: "Order Management\nClient Accounts\nBasic Analytics",
    isActive: true,
    transactionFeePercent: 3,
  },
  scale: {
    tier: 'scale',
    status: 'active',
    maxRecords: -1,
    maxUsers: -1,
    allowOrders: true,
    allowAiFeatures: true,
    price: 79,
    quarterlyPrice: 220,
    yearlyPrice: 790,
    description: "For established distributors and power users.",
    features: "AI-powered descriptions\nAdvanced Analytics\nPriority Support",
    isActive: true,
    transactionFeePercent: 2,
  },
  collector: {
    tier: 'collector',
    status: 'active',
    maxRecords: -1,
    maxUsers: 1,
    allowOrders: false,
    allowAiFeatures: false,
    price: 4.99,
    quarterlyPrice: 13,
    yearlyPrice: 49,
    description: "For serious vinyl collectors who want more.",
    features: "Unlimited collection\nDiscogs sync\nWishlist alerts\nAdvanced search",
    isActive: true,
    transactionFeePercent: 4,
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
            const mergedTiers: Record<string, SubscriptionInfo> = {};
            for (const tier of Object.keys(defaultTiers) as SubscriptionTier[]) {
                mergedTiers[tier] = { ...defaultTiers[tier], ...dbTiers[tier] };
            }
            return mergedTiers as Record<SubscriptionTier, SubscriptionInfo>;
        } else {
            await setDoc(docRef, defaultTiers);
            return defaultTiers;
        }
    } catch (error) {
        console.error("ClientSubscriptionService: Error fetching subscription tiers:", error);
        return defaultTiers;
    }
}

/**
 * Save subscription tiers. Routes through the server endpoint, which:
 *  - validates the payload
 *  - syncs to Stripe (Products/Prices, active flag, fee rates)
 *  - writes the canonical Firestore doc
 *  - dual-writes to legacy settings/platformFees as a safety net
 *  - invalidates server-side caches
 *
 * Returns the server response (tiers + stripeSync summary) or throws on error
 * so the admin UI can surface details.
 */
export interface UpdateTiersResult {
  success: boolean;
  tiers: Record<SubscriptionTier, SubscriptionInfo>;
  stripeSync: {
    mode: 'live' | 'test' | 'skipped-no-key' | 'skipped-kill-switch';
    actions: Array<Record<string, unknown>>;
  };
}

export async function updateSubscriptionTiers(
  tiers: Record<SubscriptionTier, SubscriptionInfo>,
): Promise<UpdateTiersResult> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Not authenticated.');
  }
  const idToken = await user.getIdToken();

  const res = await fetch('/api/admin/subscription-tiers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ tiers }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error || `Save failed (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data as UpdateTiersResult;
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

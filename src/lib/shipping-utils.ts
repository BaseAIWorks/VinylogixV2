import type { ShippingConfig, ShippingZone } from '@/types';

export interface ShippingResult {
  shippingCost: number;
  zoneName: string | null;
  freeShippingApplied: boolean;
  method: 'shipping' | 'pickup';
}

/**
 * Find the shipping zone that contains the given country.
 * Returns null if no zone matches.
 */
export function findShippingZone(
  config: ShippingConfig | undefined,
  customerCountry: string | undefined
): ShippingZone | null {
  if (!config?.enabled || !customerCountry || !config.zones?.length) return null;
  const countryLower = customerCountry.trim().toLowerCase();
  return config.zones.find(zone =>
    zone.countries.some(c => c.trim().toLowerCase() === countryLower)
  ) || null;
}

/**
 * Calculate shipping cost based on weight, country, and distributor config.
 *
 * @param config - Distributor's shipping configuration
 * @param customerCountry - Customer's country name
 * @param totalWeightGrams - Total order weight in grams
 * @param productSubtotal - Product subtotal in euros (for free shipping threshold)
 * @param method - 'shipping' or 'pickup'
 */
export function calculateShipping(
  config: ShippingConfig | undefined,
  customerCountry: string | undefined,
  totalWeightGrams: number,
  productSubtotal: number,
  method: 'shipping' | 'pickup' = 'shipping'
): ShippingResult {
  // Shipping not configured
  if (!config?.enabled) {
    return { shippingCost: 0, zoneName: null, freeShippingApplied: false, method: 'shipping' };
  }

  // Pickup selected
  if (method === 'pickup' && config.allowPickup) {
    return { shippingCost: 0, zoneName: null, freeShippingApplied: false, method: 'pickup' };
  }

  // Free shipping threshold
  if (config.freeShippingThreshold && productSubtotal >= config.freeShippingThreshold) {
    const zone = findShippingZone(config, customerCountry);
    return {
      shippingCost: 0,
      zoneName: zone?.name || null,
      freeShippingApplied: true,
      method: 'shipping',
    };
  }

  // Find matching zone
  const zone = findShippingZone(config, customerCountry);
  if (!zone) {
    return { shippingCost: 0, zoneName: null, freeShippingApplied: false, method: 'shipping' };
  }

  if (!zone.rateTiers?.length) {
    return { shippingCost: 0, zoneName: zone.name, freeShippingApplied: false, method: 'shipping' };
  }

  // Sort tiers by minWeight ascending
  const sortedTiers = [...zone.rateTiers].sort((a, b) => a.minWeightGrams - b.minWeightGrams);

  // Find the matching tier
  let matchedTier = sortedTiers.find(
    tier => totalWeightGrams >= tier.minWeightGrams && totalWeightGrams < tier.maxWeightGrams
  );

  // If weight exceeds all tiers, use the highest tier
  if (!matchedTier) {
    matchedTier = sortedTiers[sortedTiers.length - 1];
  }

  return {
    shippingCost: matchedTier.price,
    zoneName: zone.name,
    freeShippingApplied: false,
    method: 'shipping',
  };
}

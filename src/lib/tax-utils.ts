export interface TaxResult {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxRate: number;
  isReverseCharge: boolean;
}

export const TAX_LABELS = [
  { value: 'BTW', description: 'Nederland, België' },
  { value: 'IVA', description: 'Spanje, Italië, Portugal' },
  { value: 'MwSt', description: 'Duitsland, Oostenrijk, Zwitserland' },
  { value: 'TVA', description: 'Frankrijk, België (FR), Luxemburg' },
  { value: 'VAT', description: 'Ierland, VK, internationaal' },
] as const;

const EU_COUNTRIES = [
  'Austria', 'Belgium', 'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic',
  'Denmark', 'Estonia', 'Finland', 'France', 'Germany', 'Greece', 'Hungary',
  'Ireland', 'Italy', 'Latvia', 'Lithuania', 'Luxembourg', 'Malta',
  'Netherlands', 'Poland', 'Portugal', 'Romania', 'Slovakia', 'Slovenia',
  'Spain', 'Sweden',
];

export function isEuCountry(country: string): boolean {
  return EU_COUNTRIES.some(c => c.toLowerCase() === country.toLowerCase());
}

/**
 * Determine if reverse charge applies.
 * Reverse charge = B2B intra-EU: customer has VAT number + different EU country than seller.
 */
export function isReverseChargeApplicable(
  customerVatNumber: string | undefined,
  customerCountry: string | undefined,
  distributorCountry: string | undefined
): boolean {
  if (!customerVatNumber || !customerCountry || !distributorCountry) return false;
  if (customerCountry.toLowerCase() === distributorCountry.toLowerCase()) return false;
  return isEuCountry(customerCountry) && isEuCountry(distributorCountry);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calculate tax for a given amount.
 *
 * @param amount - The price (inclusive or exclusive of tax depending on behavior)
 * @param rate - Tax rate in percent (e.g., 21)
 * @param behavior - 'inclusive' = amount includes tax, 'exclusive' = tax added on top
 * @param reverseCharge - If true, effective rate is 0% (B2B intra-EU)
 */
export function calculateTax(
  amount: number,
  rate: number,
  behavior: 'inclusive' | 'exclusive',
  reverseCharge: boolean = false
): TaxResult {
  if (rate <= 0 && !reverseCharge) {
    return { subtotal: amount, taxAmount: 0, total: amount, taxRate: 0, isReverseCharge: false };
  }

  if (reverseCharge) {
    if (behavior === 'inclusive') {
      // Price was inclusive of tax — remove the tax, customer pays less
      const subtotal = round2(amount / (1 + rate / 100));
      return { subtotal, taxAmount: 0, total: subtotal, taxRate: 0, isReverseCharge: true };
    } else {
      // Price was exclusive — no tax added
      return { subtotal: amount, taxAmount: 0, total: amount, taxRate: 0, isReverseCharge: true };
    }
  }

  if (behavior === 'inclusive') {
    const subtotal = round2(amount / (1 + rate / 100));
    const taxAmount = round2(amount - subtotal);
    return { subtotal, taxAmount, total: amount, taxRate: rate, isReverseCharge: false };
  } else {
    const taxAmount = round2(amount * (rate / 100));
    const total = round2(amount + taxAmount);
    return { subtotal: amount, taxAmount, total, taxRate: rate, isReverseCharge: false };
  }
}

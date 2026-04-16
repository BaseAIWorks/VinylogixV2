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
  { value: 'MwSt', description: 'Duitsland, Oostenrijk' },
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

/** Map country names to VIES member-state codes */
const COUNTRY_TO_VIES_CODE: Record<string, string> = {
  austria: 'AT', belgium: 'BE', bulgaria: 'BG', croatia: 'HR',
  cyprus: 'CY', 'czech republic': 'CZ', czechia: 'CZ',
  denmark: 'DK', estonia: 'EE', finland: 'FI', france: 'FR',
  germany: 'DE', greece: 'EL', hungary: 'HU', ireland: 'IE',
  italy: 'IT', latvia: 'LV', lithuania: 'LT', luxembourg: 'LU',
  malta: 'MT', netherlands: 'NL', 'the netherlands': 'NL',
  nederland: 'NL', poland: 'PL', portugal: 'PT', romania: 'RO',
  slovakia: 'SK', slovenia: 'SI', spain: 'ES', sweden: 'SE',
};

/**
 * Convert a country name to the VIES member-state code.
 * Also accepts 2-letter ISO codes directly.
 */
export function countryToViesCode(country: string): string | null {
  const trimmed = country.trim();
  // Already a 2-letter code?
  const upper = trimmed.toUpperCase();
  if (upper.length === 2 && Object.values(COUNTRY_TO_VIES_CODE).includes(upper)) {
    // Greece is 'GR' as ISO but 'EL' in VIES
    return upper === 'GR' ? 'EL' : upper;
  }
  return COUNTRY_TO_VIES_CODE[trimmed.toLowerCase()] || null;
}

/**
 * Strip the country prefix from a VAT number if present.
 * E.g. "NL123456789B01" with countryCode "NL" → "123456789B01"
 */
export function stripVatPrefix(vatNumber: string, countryCode: string): string {
  const trimmed = vatNumber.trim().toUpperCase();
  const code = countryCode.toUpperCase();
  if (trimmed.startsWith(code)) {
    return trimmed.slice(code.length);
  }
  // Greece: ISO is GR, VIES is EL
  if (code === 'EL' && trimmed.startsWith('GR')) {
    return trimmed.slice(2);
  }
  return trimmed;
}

export function isEuCountry(country: string): boolean {
  return EU_COUNTRIES.some(c => c.toLowerCase() === country.toLowerCase());
}

/**
 * Determine if reverse charge applies.
 * Reverse charge = B2B intra-EU: customer has VAT number + different EU country than seller.
 *
 * When `validated` is supplied and `requireValidated` is true, the result only
 * returns true if the VAT number has been VIES-verified. Use this form on
 * order-creation paths where we need legal certainty before shifting the tax
 * liability to the buyer. UI previews (cart, checkout preview) can leave
 * `requireValidated` unset to give immediate feedback based on the entered
 * VAT number, and show a "verify to apply" hint alongside.
 */
export function isReverseChargeApplicable(
  customerVatNumber: string | undefined,
  customerCountry: string | undefined,
  distributorCountry: string | undefined,
  opts?: { validated?: boolean; requireValidated?: boolean }
): boolean {
  if (!customerVatNumber || !customerCountry || !distributorCountry) return false;
  if (customerCountry.toLowerCase() === distributorCountry.toLowerCase()) return false;
  if (!isEuCountry(customerCountry) || !isEuCountry(distributorCountry)) return false;
  if (opts?.requireValidated && !opts.validated) return false;
  return true;
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

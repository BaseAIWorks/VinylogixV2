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

/** Map country names to VIES member-state codes. Accepts common localized
 *  names (German, French, Dutch, Spanish, Italian, Portuguese) in addition
 *  to English so profiles like "Nederland" or "España" are recognised. */
const COUNTRY_TO_VIES_CODE: Record<string, string> = {
  // Austria
  austria: 'AT', österreich: 'AT', oesterreich: 'AT', autriche: 'AT',
  // Belgium
  belgium: 'BE', belgië: 'BE', belgie: 'BE', belgique: 'BE', belgien: 'BE',
  // Bulgaria
  bulgaria: 'BG', bulgarije: 'BG', bulgarien: 'BG', bulgarie: 'BG',
  // Croatia
  croatia: 'HR', kroatië: 'HR', kroatie: 'HR', kroatien: 'HR', croatie: 'HR', hrvatska: 'HR',
  // Cyprus
  cyprus: 'CY', cypern: 'CY', chypre: 'CY', κυπρος: 'CY',
  // Czech Republic
  'czech republic': 'CZ', czechia: 'CZ', tsjechië: 'CZ', tsjechie: 'CZ', tschechien: 'CZ', république_tchèque: 'CZ',
  // Denmark
  denmark: 'DK', denemarken: 'DK', dänemark: 'DK', danemark: 'DK',
  // Estonia
  estonia: 'EE', estland: 'EE', estonie: 'EE', eesti: 'EE',
  // Finland
  finland: 'FI', finlande: 'FI', suomi: 'FI', finnland: 'FI',
  // France
  france: 'FR', frankrijk: 'FR', frankreich: 'FR', francia: 'FR',
  // Germany
  germany: 'DE', duitsland: 'DE', deutschland: 'DE', allemagne: 'DE', alemania: 'DE', germania: 'DE',
  // Greece
  greece: 'EL', griekenland: 'EL', griechenland: 'EL', grèce: 'EL', grecia: 'EL', ελλαδα: 'EL',
  // Hungary
  hungary: 'HU', hongarije: 'HU', ungarn: 'HU', hongrie: 'HU', magyarország: 'HU', magyarorszag: 'HU',
  // Ireland
  ireland: 'IE', ierland: 'IE', irland: 'IE', irlande: 'IE', irlanda: 'IE', éire: 'IE', eire: 'IE',
  // Italy
  italy: 'IT', italië: 'IT', italie: 'IT', italien: 'IT', italia: 'IT',
  // Latvia
  latvia: 'LV', letland: 'LV', lettland: 'LV', lettonie: 'LV', latvija: 'LV',
  // Lithuania
  lithuania: 'LT', litouwen: 'LT', litauen: 'LT', lituanie: 'LT', lietuva: 'LT',
  // Luxembourg
  luxembourg: 'LU', luxemburg: 'LU', luxemburgo: 'LU',
  // Malta
  malta: 'MT', 'малта': 'MT',
  // Netherlands
  netherlands: 'NL', 'the netherlands': 'NL', nederland: 'NL', niederlande: 'NL', 'pays-bas': 'NL', países_bajos: 'NL', olanda: 'NL',
  // Poland
  poland: 'PL', polen: 'PL', pologne: 'PL', polska: 'PL', polonia: 'PL',
  // Portugal
  portugal: 'PT', portugese_republiek: 'PT',
  // Romania
  romania: 'RO', roemenië: 'RO', roemenie: 'RO', rumänien: 'RO', roumanie: 'RO', românia: 'RO',
  // Slovakia
  slovakia: 'SK', slowakije: 'SK', slowakei: 'SK', slovaquie: 'SK', slovensko: 'SK', eslovaquia: 'SK',
  // Slovenia
  slovenia: 'SI', slovenië: 'SI', slovenie: 'SI', slowenien: 'SI', slovénie: 'SI', slovenija: 'SI', eslovenia: 'SI',
  // Spain
  spain: 'ES', spanje: 'ES', spanien: 'ES', espagne: 'ES', españa: 'ES', espana: 'ES', spagna: 'ES',
  // Sweden
  sweden: 'SE', zweden: 'SE', schweden: 'SE', suède: 'SE', suecia: 'SE', svezia: 'SE', sverige: 'SE',
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
  // Delegate to countryToViesCode so we accept country names in many languages
  // (e.g. "Nederland" for Netherlands, "España" for Spain) plus the 2-letter
  // ISO codes. Previously this used a hardcoded English-name list which
  // silently returned false for localized names and killed reverse-charge
  // detection for EU-based clients whose profile country was in Dutch.
  return countryToViesCode(country) !== null;
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
  if (!customerVatNumber || !distributorCountry) return false;
  if (!isEuCountry(distributorCountry)) return false;

  // Resolve customer country. Prefer the profile country; fall back to the
  // VAT-number prefix (e.g. "NL005285017B34" → NL) so a missing or oddly-
  // named customerCountry field doesn't silently disable reverse charge.
  const customerCode = customerCountry
    ? countryToViesCode(customerCountry)
    : null;
  const prefixCode = (() => {
    const upper = customerVatNumber.trim().toUpperCase();
    // 2-letter alpha prefix, must be a known VIES member state
    const m = upper.match(/^([A-Z]{2})/);
    if (!m) return null;
    const code = m[1];
    // Special case: Greece VIES code is EL even though ISO is GR
    if (code === 'GR' || code === 'EL') return 'EL';
    return Object.values(COUNTRY_TO_VIES_CODE).includes(code) ? code : null;
  })();
  const effectiveCustomerCode = customerCode || prefixCode;
  if (!effectiveCustomerCode) return false;

  const distributorCode = countryToViesCode(distributorCountry);
  if (!distributorCode) return false;
  if (effectiveCustomerCode === distributorCode) return false;

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

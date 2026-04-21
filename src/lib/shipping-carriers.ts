// Shared carrier metadata for the shipping flow:
// - URL templates per carrier so we can construct a tracking URL from a bare number
// - Soft regex validators (warnings, not hard blocks — carriers do change formats)
// - A URL parser that detects carrier + tracking number from a pasted tracking URL

export type Carrier = 'postnl' | 'dhl' | 'ups' | 'fedex' | 'dpd' | 'gls' | 'correos' | 'other';

export const CARRIERS: Carrier[] = ['postnl', 'dhl', 'ups', 'fedex', 'dpd', 'gls', 'correos', 'other'];

export const CARRIER_LABELS: Record<Carrier, string> = {
  postnl: 'PostNL',
  dhl: 'DHL',
  ups: 'UPS',
  fedex: 'FedEx',
  dpd: 'DPD',
  gls: 'GLS',
  correos: 'Correos',
  other: 'Other',
};

const URL_BUILDERS: Record<Exclude<Carrier, 'other'>, (trackingNumber: string) => string> = {
  postnl: (n) => `https://postnl.nl/tracktrace/?B=${encodeURIComponent(n)}&D=NL&T=C`,
  dhl:    (n) => `https://www.dhl.com/global-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
  ups:    (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  fedex:  (n) => `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(n)}`,
  dpd:    (n) => `https://www.dpd.com/tracking?query=${encodeURIComponent(n)}`,
  gls:    (n) => `https://gls-group.com/track?match=${encodeURIComponent(n)}`,
  correos: (n) => `https://www.correos.es/es/es/herramientas/localizador/envios/detalle?tracking-number=${encodeURIComponent(n)}`,
};

// Soft per-carrier validators. These catch obvious typos but won't reject
// unusual-but-valid numbers. Treat mismatches as warnings in the UI, not errors.
const VALIDATORS: Record<Exclude<Carrier, 'other'>, RegExp> = {
  postnl: /^3S[A-Z0-9]{10,20}$/i,
  dhl:    /^\d{10,14}$/,
  ups:    /^1Z[A-Z0-9]{16}$/i,
  fedex:  /^\d{12,20}$/,
  dpd:    /^\d{14}$|^[A-Z0-9]{8,20}$/i,
  gls:    /^\d{8,20}$/,
  correos: /^[A-Z]{2}\d{9}[A-Z]{2}$|^[A-Z]{2}\d{9}ES$|^\d{13,14}$/i,
};

// URL-pattern based detection. Used when the distributor pastes a full
// tracking URL from a carrier email — we extract carrier + number so they
// don't have to manually pick the dropdown.
const URL_PARSERS: Array<{
  carrier: Exclude<Carrier, 'other'>;
  patterns: RegExp[];
  extract: (url: URL) => string | null;
}> = [
  {
    carrier: 'postnl',
    patterns: [/postnl\./i, /jouw\.postnl\./i],
    extract: (url) => url.searchParams.get('B') || url.searchParams.get('barcode'),
  },
  {
    carrier: 'dhl',
    patterns: [/dhl\./i],
    extract: (url) =>
      url.searchParams.get('tracking-id') ||
      url.searchParams.get('trackingId') ||
      url.searchParams.get('AWB') ||
      null,
  },
  {
    carrier: 'ups',
    patterns: [/ups\.com/i],
    extract: (url) => url.searchParams.get('tracknum') || url.searchParams.get('InquiryNumber1'),
  },
  {
    carrier: 'fedex',
    patterns: [/fedex\.com/i],
    extract: (url) => url.searchParams.get('tracknumbers') || url.searchParams.get('trknbr'),
  },
  {
    carrier: 'dpd',
    patterns: [/dpd\./i],
    extract: (url) => url.searchParams.get('query') || url.searchParams.get('parcelNumber'),
  },
  {
    carrier: 'gls',
    patterns: [/gls-group\./i, /gls\-/i],
    extract: (url) => url.searchParams.get('match') || url.searchParams.get('trackNr'),
  },
  {
    carrier: 'correos',
    patterns: [/correos\.es/i, /correos\.com/i],
    extract: (url) =>
      url.searchParams.get('tracking-number') ||
      url.searchParams.get('numero') ||
      url.searchParams.get('envio') ||
      null,
  },
];

export function buildTrackingUrl(carrier: Carrier, trackingNumber: string): string | undefined {
  if (!trackingNumber) return undefined;
  if (carrier === 'other') return undefined;
  const fn = URL_BUILDERS[carrier];
  return fn ? fn(trackingNumber.trim()) : undefined;
}

export interface ValidationResult {
  ok: boolean;
  warning?: string;
}

export function validateTrackingNumber(carrier: Carrier, trackingNumber: string): ValidationResult {
  const trimmed = trackingNumber.trim();
  if (!trimmed) return { ok: false, warning: 'Tracking number is required.' };
  if (carrier === 'other') return { ok: true };
  const rx = VALIDATORS[carrier];
  if (!rx) return { ok: true };
  if (!rx.test(trimmed)) {
    return {
      ok: true, // soft: never block on format alone
      warning: `Doesn't look like a typical ${CARRIER_LABELS[carrier]} tracking number — double-check before sending.`,
    };
  }
  return { ok: true };
}

export interface ParsedTracking {
  carrier: Carrier;
  trackingNumber: string;
}

// Parse a free-form string that the user pasted: either a bare tracking
// number or a carrier URL. Returns null if nothing recognizable.
export function parseTrackingInput(input: string): ParsedTracking | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try URL first
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    for (const parser of URL_PARSERS) {
      if (parser.patterns.some(p => p.test(url.hostname))) {
        const number = parser.extract(url);
        if (number) {
          return { carrier: parser.carrier, trackingNumber: number.trim() };
        }
      }
    }
    return null;
  }

  // Bare string — try each validator to guess carrier
  for (const carrier of Object.keys(VALIDATORS) as Array<Exclude<Carrier, 'other'>>) {
    if (VALIDATORS[carrier].test(trimmed)) {
      return { carrier, trackingNumber: trimmed };
    }
  }

  return null;
}

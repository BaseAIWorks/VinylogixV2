import { parseISO, differenceInCalendarDays, startOfMonth, format } from 'date-fns';
import type { Order } from '@/types';

export const MANUAL_PAYMENT_METHODS = new Set([
  'bank_transfer',
  'cash',
  'paypal_external',
  'stripe_external',
  'other',
]);

export const PLATFORM_PAYMENT_METHODS = new Set(['stripe', 'paypal']);

export const AWAITING_PAYMENT_STATUSES = new Set(['awaiting_payment', 'pending']);

export function isManualPayment(order: Order): boolean {
  return !!order.paymentMethod && MANUAL_PAYMENT_METHODS.has(order.paymentMethod);
}

export function isPlatformPayment(order: Order): boolean {
  return !!order.paymentMethod && PLATFORM_PAYMENT_METHODS.has(order.paymentMethod);
}

export function isAwaitingPayment(order: Order): boolean {
  return AWAITING_PAYMENT_STATUSES.has(order.status);
}

export function getPlatformFeeEuros(order: Order): number {
  if (!order.platformFeeAmount) return 0;
  if (!isPlatformPayment(order) && order.paymentMethod) return 0;
  return order.platformFeeAmount / 100;
}

export function deriveSubtotal(order: Order): number {
  if (typeof order.subtotalAmount === 'number') return order.subtotalAmount;
  const tax = order.taxAmount || 0;
  const shipping = order.shippingCost || 0;
  const discount = order.discountAmount || 0;
  return Math.max(0, order.totalAmount - tax - shipping + discount);
}

export function getVatEuros(order: Order): number {
  return order.taxAmount || 0;
}

export function getShippingEuros(order: Order): number {
  return order.shippingCost || 0;
}

export function getNetPayoutEuros(order: Order): number {
  return order.totalAmount - getPlatformFeeEuros(order);
}

function parseDateSafe(iso?: string): Date | null {
  if (!iso) return null;
  try {
    return parseISO(iso);
  } catch {
    return null;
  }
}

export type AgeBucket = '0-30' | '31-60' | '61-90' | '90+';
export const AGE_BUCKETS: AgeBucket[] = ['0-30', '31-60', '61-90', '90+'];

export function bucketAgeFromApproved(order: Order, now: Date = new Date()): AgeBucket {
  const ref = parseDateSafe(order.approvedAt) || parseDateSafe(order.createdAt) || now;
  const days = differenceInCalendarDays(now, ref);
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export type PaidFilter = 'paid' | 'refunded' | 'any';

function isWithinRange(order: Order, from?: Date, to?: Date, dateField: 'paidAt' | 'createdAt' | 'approvedAt' = 'paidAt'): boolean {
  const refIso = order[dateField] || order.createdAt;
  const d = parseDateSafe(refIso);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export interface FinancialSummary {
  orderCount: number;
  refundCount: number;
  grossRevenue: number;      // subtotal ex-VAT, pre-refund
  refundedRevenue: number;   // subtotal ex-VAT of refunded orders in range
  netRevenue: number;        // gross - refunded
  vatCollected: number;      // paid tax minus refunded tax
  vatRefunded: number;
  vatReverseChargeCount: number;
  shippingCollected: number;
  shippingRefunded: number;
  platformFeesPaid: number;
  netPayout: number;         // totalAmount - platformFee, net of refunds
  grossTotal: number;        // order totalAmount sum (pre-refund)
  refundedTotal: number;
  discountsGiven: number;
  avgOrderValue: number;
  platformOrderCount: number;
  manualOrderCount: number;
  platformRevenue: number;   // gross (subtotal) via platform methods
  manualRevenue: number;     // gross (subtotal) via manual methods
  // Per-method subtotals for the manual breakdown card. Keyed by
  // Order['paymentMethod'] — only manual methods populated here (platform
  // methods are rolled up in platformRevenue).
  manualRevenueByMethod: Record<string, { subtotal: number; count: number }>;
  effectiveFeeRate: number;  // platformFeesPaid / platformRevenue
}

const EMPTY_SUMMARY: FinancialSummary = {
  orderCount: 0,
  refundCount: 0,
  grossRevenue: 0,
  refundedRevenue: 0,
  netRevenue: 0,
  vatCollected: 0,
  vatRefunded: 0,
  vatReverseChargeCount: 0,
  shippingCollected: 0,
  shippingRefunded: 0,
  platformFeesPaid: 0,
  netPayout: 0,
  grossTotal: 0,
  refundedTotal: 0,
  discountsGiven: 0,
  avgOrderValue: 0,
  platformOrderCount: 0,
  manualOrderCount: 0,
  platformRevenue: 0,
  manualRevenue: 0,
  manualRevenueByMethod: {},
  effectiveFeeRate: 0,
};

function sumRefunds(order: Order): number {
  if (!order.refunds || order.refunds.length === 0) return 0;
  return order.refunds.reduce((s, r) => s + (r.amount || 0), 0);
}

export function summarizePaidOrders(orders: Order[], from?: Date, to?: Date): FinancialSummary {
  // "Received" = any order we've been paid on, even partially
  const receivedInRange = orders.filter(o =>
    (o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded') &&
    isWithinRange(o, from, to, 'paidAt')
  );
  // Fully refunded orders are tracked separately
  const fullyRefundedInRange = orders.filter(o =>
    o.paymentStatus === 'refunded' && isWithinRange(o, from, to, 'paidAt')
  );

  if (receivedInRange.length === 0 && fullyRefundedInRange.length === 0) {
    return { ...EMPTY_SUMMARY, manualRevenueByMethod: {} };
  }

  const s: FinancialSummary = { ...EMPTY_SUMMARY, manualRevenueByMethod: {} };

  for (const o of receivedInRange) {
    const sub = deriveSubtotal(o);
    const vat = getVatEuros(o);
    const ship = getShippingEuros(o);
    const fee = getPlatformFeeEuros(o);
    const refunded = sumRefunds(o);
    s.orderCount += 1;
    s.grossRevenue += sub;
    s.vatCollected += vat;
    s.shippingCollected += ship;
    s.platformFeesPaid += fee;
    s.grossTotal += o.totalAmount;
    s.discountsGiven += o.discountAmount || 0;
    if (o.isReverseCharge) s.vatReverseChargeCount += 1;
    if (isPlatformPayment(o)) {
      s.platformOrderCount += 1;
      s.platformRevenue += sub;
    } else if (isManualPayment(o)) {
      s.manualOrderCount += 1;
      s.manualRevenue += sub;
      const key = o.paymentMethod!;
      const existing = s.manualRevenueByMethod[key];
      if (existing) {
        existing.subtotal += sub;
        existing.count += 1;
      } else {
        s.manualRevenueByMethod[key] = { subtotal: sub, count: 1 };
      }
    }
    // Partial refund contribution. Pro-rate against the order total for
    // reconciliation purposes; exact per-line breakdown would require
    // per-refund tax metadata we don't collect today.
    if (refunded > 0 && o.totalAmount > 0) {
      s.refundCount += 1;
      const ratio = refunded / o.totalAmount;
      s.refundedRevenue += sub * ratio;
      s.vatRefunded += vat * ratio;
      s.shippingRefunded += ship * ratio;
      s.refundedTotal += refunded;
    }
  }

  for (const o of fullyRefundedInRange) {
    const sub = deriveSubtotal(o);
    s.refundCount += 1;
    s.refundedRevenue += sub;
    s.vatRefunded += getVatEuros(o);
    s.shippingRefunded += getShippingEuros(o);
    s.refundedTotal += o.totalAmount;
  }

  s.netRevenue = s.grossRevenue - s.refundedRevenue;
  s.netPayout = s.grossTotal - s.platformFeesPaid - s.refundedTotal;
  s.avgOrderValue = s.orderCount > 0 ? s.grossTotal / s.orderCount : 0;
  s.effectiveFeeRate = s.platformRevenue > 0 ? s.platformFeesPaid / s.platformRevenue : 0;

  return s;
}

export interface AwaitingPaymentsSummary {
  total: number;              // sum of totalAmount
  count: number;
  buckets: Record<AgeBucket, { total: number; count: number }>;
  orderIds: string[];
}

export function summarizeAwaitingPayments(orders: Order[], now: Date = new Date()): AwaitingPaymentsSummary {
  const awaiting = orders.filter(isAwaitingPayment);
  const buckets: Record<AgeBucket, { total: number; count: number }> = {
    '0-30': { total: 0, count: 0 },
    '31-60': { total: 0, count: 0 },
    '61-90': { total: 0, count: 0 },
    '90+': { total: 0, count: 0 },
  };
  let total = 0;
  const orderIds: string[] = [];
  for (const o of awaiting) {
    const b = bucketAgeFromApproved(o, now);
    buckets[b].total += o.totalAmount;
    buckets[b].count += 1;
    total += o.totalAmount;
    orderIds.push(o.id);
  }
  return { total, count: awaiting.length, buckets, orderIds };
}

export interface MonthlyRevenuePoint {
  monthKey: string;          // 'yyyy-MM'
  monthLabel: string;        // 'MMM yyyy'
  subtotal: number;
  vat: number;
  shipping: number;
  total: number;
  count: number;
}

export function aggregateRevenueByMonth(orders: Order[], from?: Date, to?: Date): MonthlyRevenuePoint[] {
  // Include partially-refunded orders — they still contributed to revenue
  // in the period they were paid, minus whatever was refunded. Keeping them
  // here makes the chart consistent with `summarizePaidOrders`.
  const paid = orders.filter(o =>
    (o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded') &&
    isWithinRange(o, from, to, 'paidAt')
  );
  const byMonth = new Map<string, MonthlyRevenuePoint>();
  for (const o of paid) {
    const d = parseDateSafe(o.paidAt);
    if (!d) continue;
    const anchor = startOfMonth(d);
    const key = format(anchor, 'yyyy-MM');
    const label = format(anchor, 'MMM yyyy');
    const point = byMonth.get(key) || {
      monthKey: key, monthLabel: label, subtotal: 0, vat: 0, shipping: 0, total: 0, count: 0,
    };
    point.subtotal += deriveSubtotal(o);
    point.vat += getVatEuros(o);
    point.shipping += getShippingEuros(o);
    point.total += o.totalAmount;
    point.count += 1;
    byMonth.set(key, point);
  }
  return Array.from(byMonth.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
}

export interface VatBreakdownRow {
  label: string;             // e.g. '21%', '9%', '0% (reverse charge)'
  rate: number;              // 0.21, 0.09, 0
  amount: number;            // €
  isReverseCharge?: boolean;
}

export function aggregateVatBreakdown(orders: Order[], from?: Date, to?: Date): VatBreakdownRow[] {
  const paid = orders.filter(o =>
    (o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded') &&
    isWithinRange(o, from, to, 'paidAt')
  );
  const byRate = new Map<string, VatBreakdownRow>();
  let reverseChargeCount = 0;
  let reverseChargeSubtotal = 0;

  for (const o of paid) {
    if (o.isReverseCharge) {
      reverseChargeCount += 1;
      reverseChargeSubtotal += deriveSubtotal(o);
      continue;
    }
    if (o.taxBreakdown && o.taxBreakdown.length > 0) {
      for (const tb of o.taxBreakdown) {
        const key = `r-${tb.rate}`;
        const row = byRate.get(key) || { label: `${(tb.rate * 100).toFixed(0)}%`, rate: tb.rate, amount: 0 };
        row.amount += tb.amount;
        byRate.set(key, row);
      }
    } else if (o.taxAmount && o.taxRate !== undefined) {
      const key = `r-${o.taxRate}`;
      const row = byRate.get(key) || { label: `${(o.taxRate * 100).toFixed(0)}%`, rate: o.taxRate, amount: 0 };
      row.amount += o.taxAmount;
      byRate.set(key, row);
    } else if (o.taxAmount) {
      const key = 'r-unknown';
      const row = byRate.get(key) || { label: 'VAT', rate: 0, amount: 0 };
      row.amount += o.taxAmount;
      byRate.set(key, row);
    }
  }

  const rows = Array.from(byRate.values()).sort((a, b) => b.rate - a.rate);
  if (reverseChargeCount > 0) {
    rows.push({
      label: `0% reverse charge (${reverseChargeCount})`,
      rate: 0,
      amount: 0,
      isReverseCharge: true,
    });
  }
  return rows;
}

export interface TopCustomerRow {
  viewerId: string;
  customerName: string;
  orderCount: number;
  revenue: number;  // subtotal ex-VAT
  total: number;    // gross totalAmount
}

export function topCustomersByRevenue(orders: Order[], from?: Date, to?: Date, limit = 10): TopCustomerRow[] {
  const paid = orders.filter(o =>
    (o.paymentStatus === 'paid' || o.paymentStatus === 'partially_refunded') &&
    isWithinRange(o, from, to, 'paidAt')
  );
  const byCustomer = new Map<string, TopCustomerRow>();
  for (const o of paid) {
    const key = o.viewerId || o.viewerEmail;
    const row = byCustomer.get(key) || {
      viewerId: o.viewerId,
      customerName: o.customerName || o.viewerEmail,
      orderCount: 0,
      revenue: 0,
      total: 0,
    };
    row.orderCount += 1;
    row.revenue += deriveSubtotal(o);
    row.total += o.totalAmount;
    byCustomer.set(key, row);
  }
  return Array.from(byCustomer.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export interface TimePreset {
  key: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'ytd' | 'last12mo' | 'all';
  label: string;
}

export const TIME_PRESETS: TimePreset[] = [
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'thisQuarter', label: 'This quarter' },
  { key: 'ytd', label: 'Year to date' },
  { key: 'last12mo', label: 'Last 12 months' },
  { key: 'all', label: 'All time' },
];

export interface VatReturnRow {
  orderNumber: string;
  paidAt: string;
  customer: string;
  customerVatNumber: string;
  customerCountry: string;
  subtotalExVat: number;
  vatRate: string;
  vatAmount: number;
  total: number;
  reverseCharge: 'yes' | 'no';
  currency: string;
}

export interface VatReturnSummaryRow {
  label: string;
  rate: string;
  jurisdiction: string;
  baseAmount: number;
  vatAmount: number;
  orderCount: number;
}

// ISO-3166-1 alpha-2 country codes used in EU VAT numbers, plus a few common
// non-EU codes. Used as a first-pass way to infer the customer's country
// from their VAT number before falling back to the free-text billing address.
const VAT_NUMBER_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR',
  'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO',
  'SE', 'SI', 'SK', 'XI', 'GB', 'CH', 'NO', 'US', 'CA',
]);

function countryFromVatNumber(vat: string | undefined): string {
  if (!vat) return '';
  const prefix = vat.trim().slice(0, 2).toUpperCase();
  return VAT_NUMBER_COUNTRIES.has(prefix) ? prefix : '';
}

function extractCountry(order: {
  customerVatNumber?: string;
  billingAddress?: string;
  shippingAddress?: string;
}): string {
  // Prefer the VAT number prefix — it's a structured, authoritative source
  // for tax jurisdiction. Fall back to parsing the last line of the address
  // only when no VAT number is set. Free-text addresses are brittle for tax
  // reporting (varies between "NL", "Netherlands", "Nederland", etc.).
  const fromVat = countryFromVatNumber(order.customerVatNumber);
  if (fromVat) return fromVat;
  const address = order.billingAddress || order.shippingAddress;
  if (!address) return '';
  const lines = address.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  return lines[lines.length - 1] || '';
}

export function buildVatReturn(orders: Order[], from: Date, to: Date): {
  rows: VatReturnRow[];
  summary: VatReturnSummaryRow[];
  reverseCharge: { count: number; baseAmount: number };
} {
  const paid = orders.filter(o =>
    (o.paymentStatus === 'paid' || o.paymentStatus === 'refunded') &&
    isWithinRange(o, from, to, 'paidAt')
  );

  const rows: VatReturnRow[] = [];
  const summaryMap = new Map<string, VatReturnSummaryRow>();
  let rcCount = 0;
  let rcBase = 0;

  for (const o of paid) {
    const country = extractCountry(o);
    const sub = deriveSubtotal(o);
    const multiplier = o.paymentStatus === 'refunded' ? -1 : 1;

    if (o.isReverseCharge) {
      rows.push({
        orderNumber: o.orderNumber || o.id.slice(0, 8),
        paidAt: o.paidAt || '',
        customer: o.customerName || o.viewerEmail,
        customerVatNumber: o.customerVatNumber || '',
        customerCountry: country,
        subtotalExVat: sub * multiplier,
        vatRate: '0%',
        vatAmount: 0,
        total: o.totalAmount * multiplier,
        reverseCharge: 'yes',
        currency: 'EUR',
      });
      rcCount += 1;
      rcBase += sub * multiplier;
      continue;
    }

    if (o.taxBreakdown && o.taxBreakdown.length > 0) {
      for (const tb of o.taxBreakdown) {
        const rateLabel = `${(tb.rate * 100).toFixed(0)}%`;
        const summaryKey = `${rateLabel}|${tb.jurisdiction || country || 'unknown'}`;
        // Guard against zero-rated or missing-rate entries: `tb.amount / tb.rate`
        // would otherwise yield Infinity / NaN. When the rate is 0 we can't
        // infer the base from just tax amount — leave it at 0 and let the
        // non-taxBreakdown fallback (or manual accounting) reconcile the line.
        const base = tb.rate > 0 ? (tb.amount / tb.rate) * multiplier : 0;
        rows.push({
          orderNumber: o.orderNumber || o.id.slice(0, 8),
          paidAt: o.paidAt || '',
          customer: o.customerName || o.viewerEmail,
          customerVatNumber: o.customerVatNumber || '',
          customerCountry: country,
          subtotalExVat: base,
          vatRate: rateLabel,
          vatAmount: tb.amount * multiplier,
          total: base + tb.amount * multiplier,
          reverseCharge: 'no',
          currency: 'EUR',
        });
        const entry = summaryMap.get(summaryKey) || {
          label: `${rateLabel} (${tb.jurisdiction || country || 'unknown'})`,
          rate: rateLabel,
          jurisdiction: tb.jurisdiction || country || 'unknown',
          baseAmount: 0,
          vatAmount: 0,
          orderCount: 0,
        };
        entry.baseAmount += base;
        entry.vatAmount += tb.amount * multiplier;
        entry.orderCount += 1;
        summaryMap.set(summaryKey, entry);
      }
    } else {
      const rate = o.taxRate || 0;
      const rateLabel = rate ? `${(rate * 100).toFixed(0)}%` : 'N/A';
      const vat = o.taxAmount || 0;
      rows.push({
        orderNumber: o.orderNumber || o.id.slice(0, 8),
        paidAt: o.paidAt || '',
        customer: o.customerName || o.viewerEmail,
        customerVatNumber: o.customerVatNumber || '',
        customerCountry: country,
        subtotalExVat: sub * multiplier,
        vatRate: rateLabel,
        vatAmount: vat * multiplier,
        total: o.totalAmount * multiplier,
        reverseCharge: 'no',
        currency: 'EUR',
      });
      const summaryKey = `${rateLabel}|${country || 'unknown'}`;
      const entry = summaryMap.get(summaryKey) || {
        label: `${rateLabel} (${country || 'unknown'})`,
        rate: rateLabel,
        jurisdiction: country || 'unknown',
        baseAmount: 0,
        vatAmount: 0,
        orderCount: 0,
      };
      entry.baseAmount += sub * multiplier;
      entry.vatAmount += vat * multiplier;
      entry.orderCount += 1;
      summaryMap.set(summaryKey, entry);
    }
  }

  return {
    rows,
    summary: Array.from(summaryMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
    reverseCharge: { count: rcCount, baseAmount: rcBase },
  };
}

export function resolveQuarterRange(year: number, quarter: 1 | 2 | 3 | 4): { from: Date; to: Date } {
  const startMonth = (quarter - 1) * 3;
  return {
    from: new Date(year, startMonth, 1, 0, 0, 0),
    to: new Date(year, startMonth + 3, 0, 23, 59, 59),
  };
}

export function resolvePresetRange(preset: TimePreset['key'], now: Date = new Date()): { from?: Date; to?: Date } {
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (preset) {
    case 'thisMonth':
      return { from: new Date(year, month, 1), to: now };
    case 'lastMonth':
      return { from: new Date(year, month - 1, 1), to: new Date(year, month, 0, 23, 59, 59) };
    case 'thisQuarter': {
      const qStart = Math.floor(month / 3) * 3;
      return { from: new Date(year, qStart, 1), to: now };
    }
    case 'ytd':
      return { from: new Date(year, 0, 1), to: now };
    case 'last12mo': {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return { from: d, to: now };
    }
    case 'all':
    default:
      return {};
  }
}

"use client";

import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  Euro,
  Receipt,
  Truck,
  Wallet,
  AlertCircle,
  Clock,
  Download,
  CreditCard,
  RefreshCw,
  Package,
  ArrowUpRight,
  Landmark,
  Info,
  Percent,
  Users,
  Boxes,
  FileSpreadsheet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { getOrders } from "@/services/order-service";
import type { Order } from "@/types";
import { formatPriceForDisplay } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  TIME_PRESETS,
  resolvePresetRange,
  summarizePaidOrders,
  summarizeAwaitingPayments,
  aggregateRevenueByMonth,
  aggregateVatBreakdown,
  topCustomersByRevenue,
  AGE_BUCKETS,
  buildVatReturn,
  resolveQuarterRange,
  type TimePreset,
} from "@/lib/financial-aggregations";

const EUR = (v: number) => `€ ${formatPriceForDisplay(v)}`;

const BUCKET_LABELS: Record<(typeof AGE_BUCKETS)[number], string> = {
  "0-30": "0–30 days",
  "31-60": "31–60 days",
  "61-90": "61–90 days",
  "90+": "90+ days",
};

const BUCKET_COLORS: Record<(typeof AGE_BUCKETS)[number], string> = {
  "0-30": "hsl(142, 76%, 36%)",    // green
  "31-60": "hsl(45, 93%, 47%)",    // amber
  "61-90": "hsl(25, 95%, 53%)",    // orange
  "90+": "hsl(0, 84%, 60%)",       // red
};

const METHOD_COLORS = {
  platform: "hsl(262, 83%, 58%)",
  manual: "hsl(171, 77%, 40%)",
  other: "hsl(220, 9%, 46%)",
};

// Per-method labels + colors for the manual payment breakdown.
const MANUAL_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank transfer",
  cash: "Cash",
  paypal_external: "PayPal (direct)",
  stripe_external: "Stripe (external)",
  other: "Other",
};

const MANUAL_METHOD_COLORS: Record<string, string> = {
  bank_transfer: "hsl(152, 70%, 40%)",    // emerald
  cash: "hsl(142, 76%, 36%)",              // green
  paypal_external: "hsl(217, 91%, 60%)",   // blue
  stripe_external: "hsl(262, 70%, 55%)",   // purple (lighter than platform)
  other: "hsl(220, 9%, 46%)",              // grey
};

interface FinancialKPI {
  title: string;
  value: string;
  subtext: string;
  icon: React.ElementType;
  accent: string;
  href?: string;
}

function KpiCard({ kpi }: { kpi: FinancialKPI }) {
  const inner = (
    <Card className={`relative overflow-hidden ${kpi.href ? "hover:bg-muted/50 transition-colors cursor-pointer" : ""}`}>
      <div className={`absolute top-0 left-0 h-full w-1 ${kpi.accent}`} />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
        <kpi.icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl md:text-3xl font-bold text-primary">{kpi.value}</div>
        <p className="text-xs text-muted-foreground">{kpi.subtext}</p>
      </CardContent>
    </Card>
  );
  return kpi.href ? <Link href={kpi.href}>{inner}</Link> : inner;
}

function buildOrdersHref(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") search.set(k, v);
  });
  const qs = search.toString();
  return qs ? `/orders?${qs}` : "/orders";
}

function toIsoDate(d?: Date): string | undefined {
  return d ? d.toISOString().slice(0, 10) : undefined;
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [keys.join(","), ...rows.map(r => keys.map(k => escape(r[k])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StatsFinancialPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [preset, setPreset] = useState<TimePreset["key"]>("thisMonth");
  const [isVatDialogOpen, setIsVatDialogOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [vatYear, setVatYear] = useState<number>(currentYear);
  const [vatQuarter, setVatQuarter] = useState<1 | 2 | 3 | 4>(Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4);

  const isMaster = user?.role === "master";
  const isReducedWorker =
    user?.role === "worker" && !!user?.permissions?.canViewFinancialStats;
  const hasAccess = isMaster || isReducedWorker;

  useEffect(() => {
    if (!authLoading && user && !hasAccess) {
      // Workers without financial perms — if they still have inventory access (master or selling-price),
      // send them to /stats/inventory; else to dashboard.
      if (user.permissions?.canViewSellingPrice) {
        router.replace("/stats/inventory");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, authLoading, hasAccess, router]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user || !hasAccess) return;
      setIsLoading(true);
      try {
        const fetched = await getOrders(user);
        if (active) setOrders(fetched);
      } catch (err) {
        toast({ title: "Error", description: "Failed to load orders.", variant: "destructive" });
      } finally {
        if (active) setIsLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [user, hasAccess, toast]);

  const { from, to } = useMemo(() => resolvePresetRange(preset), [preset]);
  const fromISO = toIsoDate(from);
  const toISO = toIsoDate(to);

  const summary = useMemo(() => summarizePaidOrders(orders, from, to), [orders, from, to]);
  const awaiting = useMemo(() => summarizeAwaitingPayments(orders), [orders]);
  const monthly = useMemo(() => aggregateRevenueByMonth(orders, from, to), [orders, from, to]);
  const vatRows = useMemo(() => aggregateVatBreakdown(orders, from, to), [orders, from, to]);
  const topCustomers = useMemo(() => topCustomersByRevenue(orders, from, to, 10), [orders, from, to]);

  const presetLabel = useMemo(
    () => TIME_PRESETS.find(p => p.key === preset)?.label || "",
    [preset]
  );

  const methodPieData = useMemo(() => {
    const rows: Array<{ name: string; value: number; fill: string; method?: string }> = [];
    if (summary.platformRevenue > 0) {
      rows.push({ name: "Platform (Stripe/PayPal)", value: summary.platformRevenue, fill: METHOD_COLORS.platform });
    }
    for (const [method, { subtotal }] of Object.entries(summary.manualRevenueByMethod)) {
      if (subtotal > 0) {
        rows.push({
          name: MANUAL_METHOD_LABELS[method] || method,
          value: subtotal,
          fill: MANUAL_METHOD_COLORS[method] || METHOD_COLORS.manual,
          method,
        });
      }
    }
    const other = summary.grossRevenue - summary.platformRevenue - summary.manualRevenue;
    if (other > 0.01) {
      rows.push({ name: "Unspecified", value: other, fill: METHOD_COLORS.other });
    }
    return rows;
  }, [summary]);

  const ageBucketData = useMemo(
    () => AGE_BUCKETS.map(b => ({
      bucket: BUCKET_LABELS[b],
      key: b,
      amount: awaiting.buckets[b].total,
      count: awaiting.buckets[b].count,
      fill: BUCKET_COLORS[b],
    })),
    [awaiting]
  );

  const handleExportVatReturn = () => {
    const { from: vatFrom, to: vatTo } = resolveQuarterRange(vatYear, vatQuarter);
    const report = buildVatReturn(orders, vatFrom, vatTo);

    const rows: Array<Record<string, string | number>> = [];
    // Summary header block
    rows.push({
      section: "SUMMARY",
      orderNumber: "",
      paidAt: "",
      customer: `${vatYear} Q${vatQuarter}`,
      customerVatNumber: "",
      customerCountry: "",
      subtotalExVat: "",
      vatRate: "",
      vatAmount: "",
      total: "",
      reverseCharge: "",
      currency: "",
    });
    for (const s of report.summary) {
      rows.push({
        section: "SUMMARY",
        orderNumber: "",
        paidAt: "",
        customer: s.label,
        customerVatNumber: "",
        customerCountry: s.jurisdiction,
        subtotalExVat: s.baseAmount.toFixed(2),
        vatRate: s.rate,
        vatAmount: s.vatAmount.toFixed(2),
        total: (s.baseAmount + s.vatAmount).toFixed(2),
        reverseCharge: "no",
        currency: "EUR",
      });
    }
    if (report.reverseCharge.count > 0) {
      rows.push({
        section: "SUMMARY",
        orderNumber: "",
        paidAt: "",
        customer: `Reverse-charge (${report.reverseCharge.count} orders)`,
        customerVatNumber: "",
        customerCountry: "EU",
        subtotalExVat: report.reverseCharge.baseAmount.toFixed(2),
        vatRate: "0%",
        vatAmount: "0.00",
        total: report.reverseCharge.baseAmount.toFixed(2),
        reverseCharge: "yes",
        currency: "EUR",
      });
    }
    // Spacer + detail rows
    rows.push({
      section: "", orderNumber: "", paidAt: "", customer: "", customerVatNumber: "",
      customerCountry: "", subtotalExVat: "", vatRate: "", vatAmount: "", total: "", reverseCharge: "", currency: "",
    });
    for (const r of report.rows) {
      rows.push({
        section: "DETAIL",
        orderNumber: r.orderNumber,
        paidAt: r.paidAt ? format(new Date(r.paidAt), "yyyy-MM-dd") : "",
        customer: r.customer,
        customerVatNumber: r.customerVatNumber,
        customerCountry: r.customerCountry,
        subtotalExVat: r.subtotalExVat.toFixed(2),
        vatRate: r.vatRate,
        vatAmount: r.vatAmount.toFixed(2),
        total: r.total.toFixed(2),
        reverseCharge: r.reverseCharge,
        currency: r.currency,
      });
    }
    downloadCsv(`vinylogix-vat-return-${vatYear}-Q${vatQuarter}.csv`, rows);
    setIsVatDialogOpen(false);
    toast({ title: "VAT return exported", description: `${report.rows.length} line(s) for ${vatYear} Q${vatQuarter}.` });
  };

  const handleExportCsv = () => {
    const rows = orders
      .filter(o => o.paymentStatus === "paid" || o.paymentStatus === "refunded")
      .map(o => ({
        orderNumber: o.orderNumber || o.id.slice(0, 8),
        date: o.paidAt ? format(new Date(o.paidAt), "yyyy-MM-dd") : "",
        customer: o.customerName || o.viewerEmail,
        subtotal: ((o.subtotalAmount ?? (o.totalAmount - (o.taxAmount || 0) - (o.shippingCost || 0))) ).toFixed(2),
        discount: (o.discountAmount || 0).toFixed(2),
        vat: (o.taxAmount || 0).toFixed(2),
        shipping: (o.shippingCost || 0).toFixed(2),
        total: o.totalAmount.toFixed(2),
        platformFeeEuros: ((o.platformFeeAmount || 0) / 100).toFixed(2),
        method: o.paymentMethod || "",
        paymentStatus: o.paymentStatus || "",
        status: o.status,
      }));
    downloadCsv(`vinylogix-financial-${preset}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="container mx-auto py-6 md:py-8 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <Euro className="h-7 w-7 text-primary" />
            Financial Stats
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue, VAT, shipping, platform fees, and outstanding payments — scoped to your orders.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isMaster && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/stats/inventory">
                <Boxes className="h-4 w-4 mr-2" />
                Inventory stats
              </Link>
            </Button>
          )}
          {isMaster && (
            <Button variant="outline" size="sm" onClick={() => setIsVatDialogOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              VAT return
            </Button>
          )}
          {isMaster && (
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* VAT return dialog */}
      <Dialog open={isVatDialogOpen} onOpenChange={setIsVatDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export VAT return</DialogTitle>
            <DialogDescription>
              Quarterly VAT return CSV: per-rate summary + per-order detail. Refunded orders are subtracted. Reverse-charge sales are listed separately with 0% VAT.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Year</p>
              <Select value={String(vatYear)} onValueChange={(v) => setVatYear(parseInt(v, 10))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Quarter</p>
              <Select value={String(vatQuarter)} onValueChange={(v) => setVatQuarter(parseInt(v, 10) as 1 | 2 | 3 | 4)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Q1 (Jan – Mar)</SelectItem>
                  <SelectItem value="2">Q2 (Apr – Jun)</SelectItem>
                  <SelectItem value="3">Q3 (Jul – Sep)</SelectItem>
                  <SelectItem value="4">Q4 (Oct – Dec)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVatDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleExportVatReturn}>
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filter bar */}
      <Card>
        <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Time range:
          </div>
          <Select value={preset} onValueChange={(v) => setPreset(v as TimePreset["key"])}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_PRESETS.map(p => (
                <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground sm:ml-auto">
            {from && to ? `${format(from, "PP")} – ${format(to, "PP")}` : "All time"}
          </div>
        </CardContent>
      </Card>

      {isReducedWorker && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="py-3 flex gap-2 text-xs">
            <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              You're viewing the reduced financial summary. Platform fees, payouts, and refund detail are only visible to the account owner.
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard kpi={{
          title: "Net Revenue (ex-VAT)",
          value: EUR(summary.netRevenue),
          subtext: `${summary.orderCount} paid order${summary.orderCount === 1 ? "" : "s"} · ${presetLabel}`,
          icon: Euro,
          accent: "bg-green-500",
          href: buildOrdersHref({ paymentStatus: "paid", from: fromISO, to: toISO }),
        }} />
        <KpiCard kpi={{
          title: "VAT Collected",
          value: EUR(summary.vatCollected - summary.vatRefunded),
          subtext: summary.vatReverseChargeCount > 0
            ? `${summary.vatReverseChargeCount} reverse-charge order${summary.vatReverseChargeCount === 1 ? "" : "s"} excluded`
            : "To be remitted",
          icon: Receipt,
          accent: "bg-blue-500",
        }} />
        <KpiCard kpi={{
          title: "Shipping Collected",
          value: EUR(summary.shippingCollected - summary.shippingRefunded),
          subtext: "Customer-paid shipping",
          icon: Truck,
          accent: "bg-indigo-500",
        }} />
        {isMaster ? (
          <KpiCard kpi={{
            title: "Net Payout",
            value: EUR(summary.netPayout),
            subtext: `Gross total minus platform fees${summary.refundCount ? ` & ${summary.refundCount} refund${summary.refundCount === 1 ? "" : "s"}` : ""}`,
            icon: Wallet,
            accent: "bg-emerald-500",
          }} />
        ) : (
          <KpiCard kpi={{
            title: "Avg Order Value",
            value: EUR(summary.avgOrderValue),
            subtext: `Across ${summary.orderCount} order${summary.orderCount === 1 ? "" : "s"}`,
            icon: Package,
            accent: "bg-emerald-500",
          }} />
        )}
      </div>

      {/* Refunds reconciliation (master only) */}
      {isMaster && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-5 w-5 text-primary" />
              Revenue reconciliation
            </CardTitle>
            <CardDescription>
              Professional standard: gross revenue minus refunds equals net revenue. Refunds are tracked and deducted, not hidden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Gross revenue (ex-VAT)</p>
                <p className="text-xl font-semibold">{EUR(summary.grossRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">{summary.orderCount} paid order{summary.orderCount === 1 ? "" : "s"}</p>
              </div>
              <Link
                href={buildOrdersHref({ paymentStatus: "refunded", from: fromISO, to: toISO })}
                className="rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <p className="text-xs text-muted-foreground">Refunds</p>
                <p className="text-xl font-semibold text-red-600">- {EUR(summary.refundedRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.refundCount} refund{summary.refundCount === 1 ? "" : "s"}
                  {summary.orderCount + summary.refundCount > 0 && (
                    <> · {((summary.refundCount / (summary.orderCount + summary.refundCount)) * 100).toFixed(1)}% refund rate</>
                  )}
                </p>
              </Link>
              <div className="rounded-lg border bg-green-500/5 border-green-500/30 p-3">
                <p className="text-xs text-muted-foreground">Net revenue</p>
                <p className="text-xl font-semibold text-green-700">{EUR(summary.netRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">Carried to books</p>
              </div>
            </div>
            {summary.refundCount > 0 && (
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                <p>Refunded VAT: {EUR(summary.vatRefunded)} · Refunded shipping: {EUR(summary.shippingRefunded)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Platform fees (master only) */}
      {isMaster && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Landmark className="h-4 w-4 text-muted-foreground" />
                Platform fees paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{EUR(summary.platformFeesPaid)}</div>
              <p className="text-xs text-muted-foreground">On {summary.platformOrderCount} platform-processed order{summary.platformOrderCount === 1 ? "" : "s"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Percent className="h-4 w-4 text-muted-foreground" />
                Effective fee rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {(summary.effectiveFeeRate * 100).toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground">Weighted across platform revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Revenue by payment method
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {summary.platformRevenue > 0 && (
                <Link
                  href={buildOrdersHref({ paymentStatus: "paid", paymentMethodGroup: "platform", from: fromISO, to: toISO })}
                  className="flex items-center justify-between text-sm hover:bg-muted/50 rounded px-1 -mx-1"
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: METHOD_COLORS.platform }} />
                    Platform (Stripe/PayPal)
                  </span>
                  <span className="font-medium">{EUR(summary.platformRevenue)}</span>
                </Link>
              )}
              {Object.entries(summary.manualRevenueByMethod)
                .filter(([, v]) => v.subtotal > 0)
                .sort((a, b) => b[1].subtotal - a[1].subtotal)
                .map(([method, { subtotal, count }]) => (
                  <Link
                    key={method}
                    href={buildOrdersHref({ paymentStatus: "paid", paymentMethod: method, from: fromISO, to: toISO })}
                    className="flex items-center justify-between text-sm hover:bg-muted/50 rounded px-1 -mx-1"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: MANUAL_METHOD_COLORS[method] || METHOD_COLORS.manual }}
                      />
                      {MANUAL_METHOD_LABELS[method] || method}
                      <span className="text-xs text-muted-foreground">({count})</span>
                    </span>
                    <span className="font-medium">{EUR(subtotal)}</span>
                  </Link>
                ))}
              {summary.platformRevenue === 0 && summary.manualRevenue === 0 && (
                <p className="text-sm text-muted-foreground">No paid orders in this range.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue over time */}
      {monthly.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue over time</CardTitle>
            <CardDescription>Subtotal · VAT · shipping, stacked, from paid orders</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                subtotal: { label: "Subtotal", color: "hsl(142, 76%, 36%)" },
                vat: { label: "VAT", color: "hsl(217, 91%, 60%)" },
                shipping: { label: "Shipping", color: "hsl(262, 83%, 58%)" },
              }}
              className="h-[260px] w-full"
            >
              <AreaChart data={monthly}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
                <YAxis tickFormatter={(v) => `€${v}`} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="subtotal" stackId="1" fill="var(--color-subtotal)" fillOpacity={0.45} stroke="var(--color-subtotal)" strokeWidth={2} />
                <Area type="monotone" dataKey="vat" stackId="1" fill="var(--color-vat)" fillOpacity={0.4} stroke="var(--color-vat)" strokeWidth={2} />
                <Area type="monotone" dataKey="shipping" stackId="1" fill="var(--color-shipping)" fillOpacity={0.4} stroke="var(--color-shipping)" strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Awaiting payments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Awaiting payments
              </CardTitle>
              <CardDescription>
                Orders in <code className="text-xs">awaiting_payment</code> / <code className="text-xs">pending</code>, aged from approval date
              </CardDescription>
            </div>
            <Link href={buildOrdersHref({ status: "awaiting_payment" })} className="text-sm text-primary hover:underline flex items-center gap-1">
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-3">
            <p className="text-3xl font-bold text-amber-600">{EUR(awaiting.total)}</p>
            <p className="text-sm text-muted-foreground">
              {awaiting.count} order{awaiting.count === 1 ? "" : "s"} outstanding
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {AGE_BUCKETS.map(b => (
              <Link
                key={b}
                href={buildOrdersHref({ status: "awaiting_payment" })}
                className="rounded-lg border p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: BUCKET_COLORS[b] }} />
                  {BUCKET_LABELS[b]}
                </div>
                <p className="text-lg font-semibold mt-1">{EUR(awaiting.buckets[b].total)}</p>
                <p className="text-xs text-muted-foreground">{awaiting.buckets[b].count} order{awaiting.buckets[b].count === 1 ? "" : "s"}</p>
              </Link>
            ))}
          </div>
          {awaiting.count > 0 && (
            <ChartContainer
              config={{ amount: { label: "Amount", color: "hsl(45, 93%, 47%)" } }}
              className="h-[140px] w-full"
            >
              <BarChart data={ageBucketData} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `€${v}`} fontSize={11} />
                <YAxis type="category" dataKey="bucket" tickLine={false} axisLine={false} width={90} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="amount" radius={4}>
                  {ageBucketData.map((d) => (
                    <Cell key={d.key} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* VAT breakdown + method pie (master only) */}
      {isMaster && (vatRows.length > 0 || methodPieData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {vatRows.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  VAT breakdown
                </CardTitle>
                <CardDescription>Tax collected by rate{vatRows.some(r => r.isReverseCharge) ? " · reverse charge shown separately" : ""}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {vatRows.map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        {row.isReverseCharge && <Badge variant="secondary" className="text-xs">EU reverse charge</Badge>}
                        {!row.isReverseCharge && <span className="font-medium">{row.label}</span>}
                      </span>
                      <span className="font-medium">{row.isReverseCharge ? "—" : EUR(row.amount)}</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Total collected</span>
                    <span>{EUR(summary.vatCollected)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {methodPieData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Revenue by payment method
                </CardTitle>
                <CardDescription>Subtotal split by how the order was paid</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{ value: { label: "Revenue", color: "hsl(var(--chart-1))" } }}
                  className="h-[220px] w-full"
                >
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie data={methodPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {methodPieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="space-y-1 mt-2">
                  {methodPieData.map((row, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: row.fill }} />
                        {row.name}
                      </span>
                      <span className="font-medium">{EUR(row.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Top customers (master only) */}
      {isMaster && topCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Top customers by revenue
            </CardTitle>
            <CardDescription>Within {presetLabel.toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Revenue (ex-VAT)</TableHead>
                  <TableHead className="text-right">Gross total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map(c => (
                  <TableRow key={c.viewerId}>
                    <TableCell className="font-medium">{c.customerName}</TableCell>
                    <TableCell className="text-right">{c.orderCount}</TableCell>
                    <TableCell className="text-right">{EUR(c.revenue)}</TableCell>
                    <TableCell className="text-right">{EUR(c.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {summary.orderCount === 0 && summary.refundCount === 0 && awaiting.count === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No financial activity in this period.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

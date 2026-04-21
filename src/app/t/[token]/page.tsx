"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import {
  CheckCircle,
  Clock,
  Truck,
  Package,
  Receipt,
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatPriceForDisplay } from "@/lib/utils";

interface SafeOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus?: string;
  customerName?: string;
  createdAt?: string;
  paidAt?: string;
  approvedAt?: string;
  shippedAt?: string;
  estimatedDeliveryDate?: string;
  totalAmount: number;
  subtotalAmount?: number;
  taxAmount?: number;
  shippingCost?: number;
  items: Array<{
    title: string;
    artist: string;
    cover_url?: string;
    quantity: number;
    priceAtTimeOfOrder: number;
    itemStatus?: string;
  }>;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  paymentLink?: string;
  distributor?: { name?: string; email?: string; phone?: string };
}

const statusCopy: Record<string, { label: string; tone: string; icon: React.ElementType }> = {
  awaiting_approval: { label: "Awaiting approval", tone: "bg-amber-500/20 text-amber-700 border-amber-500/30", icon: Clock },
  pending: { label: "Pending", tone: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30", icon: Clock },
  awaiting_payment: { label: "Awaiting payment", tone: "bg-blue-500/20 text-blue-700 border-blue-500/30", icon: Receipt },
  paid: { label: "Paid · preparing", tone: "bg-green-500/20 text-green-700 border-green-500/30", icon: CheckCircle },
  processing: { label: "Processing", tone: "bg-purple-500/20 text-purple-700 border-purple-500/30", icon: Package },
  shipped: { label: "Shipped", tone: "bg-indigo-500/20 text-indigo-700 border-indigo-500/30", icon: Truck },
  on_hold: { label: "On hold", tone: "bg-orange-500/20 text-orange-700 border-orange-500/30", icon: AlertCircle },
  cancelled: { label: "Cancelled", tone: "bg-red-500/20 text-red-700 border-red-500/30", icon: AlertCircle },
};

function StatusStep({
  label,
  active,
  done,
  date,
}: { label: string; active: boolean; done: boolean; date?: string }) {
  return (
    <div className={`flex items-start gap-3 ${done || active ? "" : "opacity-50"}`}>
      <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0 ${
        done ? "bg-green-500 text-white" : active ? "bg-blue-500 text-white" : "bg-muted"
      }`}>
        {done ? <CheckCircle className="h-3 w-3" /> : <div className="h-2 w-2 rounded-full bg-background" />}
      </div>
      <div className="flex-1">
        <p className={`text-sm ${active ? "font-semibold" : "font-medium"}`}>{label}</p>
        {date && <p className="text-xs text-muted-foreground">{format(new Date(date), "PPp")}</p>}
      </div>
    </div>
  );
}

export default function TrackingPage() {
  const params = useParams();
  const token = typeof params?.token === "string" ? params.token : "";

  const [order, setOrder] = useState<SafeOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/public/tracking/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (!active) return;
        if (res.status === 404) {
          setError("This tracking link is invalid or has expired.");
        } else if (res.status === 429) {
          setError("Too many requests. Please try again in a moment.");
        } else if (!res.ok) {
          setError("Something went wrong. Please try again later.");
        } else {
          const data = await res.json();
          setOrder(data.order);
        }
      } catch (e) {
        if (active) setError("Network error. Please try again.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    if (token) load();
    return () => { active = false; };
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Link not available
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error || "Not found."}</p>
            <p className="text-xs text-muted-foreground">
              If you believe this is a mistake, please contact the seller directly — they can re-send the link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = statusCopy[order.status] || statusCopy.pending;
  const StatusIcon = statusInfo.icon;
  const visibleItems = order.items.filter(i => (i.itemStatus || "available") !== "not_available");

  // Step progression (approved → paid → processing → shipped)
  const paidOrBeyond = ["paid", "processing", "shipped"].includes(order.status);
  const processingOrBeyond = ["processing", "shipped"].includes(order.status);
  const shipped = order.status === "shipped";

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Order tracking</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">#{order.orderNumber}</h1>
          {order.customerName && <p className="text-sm text-muted-foreground mt-1">for {order.customerName}</p>}
        </div>

        {/* Status */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center gap-3 mb-5">
              <div className={`p-2 rounded-full ${statusInfo.tone.split(" ").slice(0, 1).join(" ")}`}>
                <StatusIcon className="h-5 w-5" />
              </div>
              <div>
                <Badge variant="outline" className={statusInfo.tone}>{statusInfo.label}</Badge>
              </div>
            </div>
            <div className="space-y-4">
              <StatusStep label="Order approved" done={!!order.approvedAt} active={order.status === "awaiting_payment"} date={order.approvedAt} />
              <StatusStep label="Payment received" done={paidOrBeyond} active={order.status === "paid"} date={order.paidAt} />
              <StatusStep label="Processing" done={shipped} active={processingOrBeyond && !shipped} />
              <StatusStep label="Shipped" done={shipped} active={shipped} date={order.shippedAt} />
            </div>

            {order.estimatedDeliveryDate && (
              <div className="mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm">
                <span className="text-muted-foreground">Estimated delivery:</span>{" "}
                <span className="font-medium">{format(new Date(order.estimatedDeliveryDate), "PPP")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment prompt (if awaiting payment) */}
        {order.paymentLink && (order.status === "awaiting_payment" || order.status === "pending") && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardContent className="py-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Payment still pending</p>
                <p className="text-xs text-muted-foreground">Use the secure link to complete your payment.</p>
              </div>
              <Button asChild>
                <a href={order.paymentLink} target="_blank" rel="noopener noreferrer">
                  Pay now <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tracking (if shipped) */}
        {order.trackingNumber && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                Shipment tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.carrier && <p className="text-muted-foreground">Carrier: <span className="font-medium text-foreground capitalize">{order.carrier}</span></p>}
              <p className="text-muted-foreground">
                Tracking number: <code className="font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">{order.trackingNumber}</code>
              </p>
              {order.trackingUrl && (
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                    Track shipment <ExternalLink className="ml-2 h-3 w-3" />
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Items */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Items ({visibleItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {item.cover_url ? (
                  <Image src={item.cover_url} alt={item.title} width={48} height={48} className="rounded object-cover h-12 w-12 flex-shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.artist} · qty {item.quantity}</p>
                </div>
                <p className="text-sm font-medium">€{formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}</p>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between text-sm">
              {typeof order.subtotalAmount === "number" && (
                <>
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>€{formatPriceForDisplay(order.subtotalAmount)}</span>
                </>
              )}
            </div>
            {!!order.taxAmount && order.taxAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">VAT</span>
                <span>€{formatPriceForDisplay(order.taxAmount)}</span>
              </div>
            )}
            {!!order.shippingCost && order.shippingCost > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>€{formatPriceForDisplay(order.shippingCost)}</span>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between text-base font-semibold">
              <span>Total</span>
              <span>€{formatPriceForDisplay(order.totalAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Distributor contact */}
        {(order.distributor?.name || order.distributor?.email) && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Questions about your order?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {order.distributor?.name && <p className="font-medium">{order.distributor.name}</p>}
              {order.distributor?.email && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <a href={`mailto:${order.distributor.email}`} className="text-primary hover:underline">{order.distributor.email}</a>
                </p>
              )}
              {order.distributor?.phone && (
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {order.distributor.phone}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground py-4">
          Powered by{" "}
          <Link href="/" className="hover:underline">
            Vinylogix
          </Link>
        </p>
      </div>
    </div>
  );
}

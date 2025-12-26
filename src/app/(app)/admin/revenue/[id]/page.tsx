"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Package,
  User,
  Building,
  CreditCard,
  Mail,
  Truck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  Receipt,
  Bell,
  ShoppingCart,
  Banknote,
  ExternalLink,
  Copy,
} from "lucide-react";
import type { Order, OrderStatus, Distributor } from "@/types";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getOrderById } from "@/services/admin-order-service";
import { getDistributorById } from "@/services/distributor-service";
import { useRouter, useParams } from "next/navigation";
import { format } from "date-fns";
import { formatPriceForDisplay } from "@/lib/utils";
import Image from "next/image";

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  awaiting_payment: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-500 border-green-500/30',
  processing: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  shipped: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
  on_hold: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  cancelled: 'bg-red-500/20 text-red-500 border-red-500/30',
};

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string | null;
  status: 'completed' | 'in_progress' | 'pending' | 'failed' | 'awaiting';
  icon: React.ElementType;
  details?: string;
}

function getTimelineEvents(order: Order, distributor: Distributor | null): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 1. Order Created
  events.push({
    id: 'order_created',
    title: 'Order Placed',
    description: `Customer ${order.customerName} placed order #${order.orderNumber}`,
    timestamp: order.createdAt,
    status: 'completed',
    icon: ShoppingCart,
    details: `${order.items.length} item(s) - Total: €${formatPriceForDisplay(order.totalAmount)}`,
  });

  // 2. Checkout Session Created
  if (order.stripeCheckoutSessionId) {
    events.push({
      id: 'checkout_created',
      title: 'Checkout Session Created',
      description: 'Stripe checkout session initiated',
      timestamp: order.createdAt,
      status: 'completed',
      icon: CreditCard,
      details: `Session: ${order.stripeCheckoutSessionId.slice(0, 20)}...`,
    });
  }

  // 3. Payment Status
  if (order.paymentStatus === 'paid') {
    events.push({
      id: 'payment_completed',
      title: 'Payment Successful',
      description: 'Customer payment completed via Stripe',
      timestamp: order.paidAt || null,
      status: 'completed',
      icon: CheckCircle2,
      details: order.stripePaymentIntentId ? `Payment Intent: ${order.stripePaymentIntentId.slice(0, 20)}...` : undefined,
    });
  } else if (order.paymentStatus === 'failed') {
    events.push({
      id: 'payment_failed',
      title: 'Payment Failed',
      description: 'Customer payment was declined or failed',
      timestamp: null,
      status: 'failed',
      icon: XCircle,
    });
  } else if (order.stripeCheckoutSessionId) {
    events.push({
      id: 'payment_pending',
      title: 'Awaiting Payment',
      description: 'Waiting for customer to complete payment',
      timestamp: null,
      status: 'awaiting',
      icon: Clock,
    });
  }

  // 4. Platform Fee Collected (only if paid)
  if (order.paymentStatus === 'paid' && order.platformFeeAmount) {
    const platformFee = order.platformFeeAmount / 100;
    events.push({
      id: 'platform_fee',
      title: 'Platform Fee Collected',
      description: `4% platform fee deducted from order`,
      timestamp: order.paidAt || null,
      status: 'completed',
      icon: Receipt,
      details: `Fee Amount: €${formatPriceForDisplay(platformFee)}`,
    });
  }

  // 5. Distributor Payout (only if paid)
  if (order.paymentStatus === 'paid') {
    const platformFee = (order.platformFeeAmount || 0) / 100;
    const payout = order.totalAmount - platformFee;

    // Check if distributor has Stripe Connect
    const hasStripeConnect = distributor?.stripeConnectAccountId;

    events.push({
      id: 'distributor_payout',
      title: 'Distributor Payout',
      description: hasStripeConnect
        ? `Payout transferred to ${distributor?.name || 'distributor'} via Stripe Connect`
        : `Payout pending - Distributor needs to connect Stripe`,
      timestamp: hasStripeConnect ? order.paidAt : null,
      status: hasStripeConnect ? 'completed' : 'awaiting',
      icon: Banknote,
      details: `Payout Amount: €${formatPriceForDisplay(payout)}`,
    });
  }

  // 6. Order Confirmation Email to Customer
  if (order.paymentStatus === 'paid') {
    events.push({
      id: 'customer_email',
      title: 'Order Confirmation Email',
      description: `Confirmation email sent to ${order.viewerEmail}`,
      timestamp: order.paidAt || null,
      status: 'completed',
      icon: Mail,
      details: 'Automated email triggered on payment success',
    });
  }

  // 7. New Order Notification to Distributor
  if (order.paymentStatus === 'paid') {
    events.push({
      id: 'distributor_notification',
      title: 'Distributor Notified',
      description: `New order notification sent to ${distributor?.name || 'distributor'}`,
      timestamp: order.paidAt || null,
      status: 'completed',
      icon: Bell,
      details: distributor?.contactEmail ? `Sent to: ${distributor.contactEmail}` : undefined,
    });
  }

  // 8. Order Processing
  if (order.status === 'processing' || order.status === 'shipped') {
    events.push({
      id: 'order_processing',
      title: 'Order Processing',
      description: 'Distributor is preparing the order for shipment',
      timestamp: order.updatedAt,
      status: 'completed',
      icon: Package,
    });
  } else if (order.paymentStatus === 'paid' && order.status === 'paid') {
    events.push({
      id: 'order_processing',
      title: 'Awaiting Processing',
      description: 'Order is waiting for distributor to begin processing',
      timestamp: null,
      status: 'awaiting',
      icon: Package,
    });
  }

  // 9. Order Shipped
  if (order.status === 'shipped') {
    events.push({
      id: 'order_shipped',
      title: 'Order Shipped',
      description: order.carrier
        ? `Shipped via ${order.carrier.toUpperCase()}`
        : 'Order has been shipped',
      timestamp: order.shippedAt || null,
      status: 'completed',
      icon: Truck,
      details: order.trackingNumber ? `Tracking: ${order.trackingNumber}` : undefined,
    });

    // Shipping notification email
    events.push({
      id: 'shipping_email',
      title: 'Shipping Notification Email',
      description: `Tracking information sent to ${order.viewerEmail}`,
      timestamp: order.shippedAt || null,
      status: order.trackingNumber ? 'completed' : 'pending',
      icon: Mail,
      details: order.trackingNumber ? 'Email includes tracking link' : 'No tracking number provided',
    });
  } else if (order.paymentStatus === 'paid' && order.status !== 'cancelled') {
    events.push({
      id: 'order_shipped',
      title: 'Shipment Pending',
      description: 'Order has not been shipped yet',
      timestamp: null,
      status: 'pending',
      icon: Truck,
    });
  }

  // 10. Order Cancelled (if applicable)
  if (order.status === 'cancelled') {
    events.push({
      id: 'order_cancelled',
      title: 'Order Cancelled',
      description: 'This order has been cancelled',
      timestamp: order.updatedAt,
      status: 'failed',
      icon: XCircle,
    });
  }

  return events;
}

const TimelineItem = ({ event, isLast }: { event: TimelineEvent; isLast: boolean }) => {
  const Icon = event.icon;

  const statusStyles = {
    completed: 'bg-green-500 text-white',
    in_progress: 'bg-blue-500 text-white animate-pulse',
    pending: 'bg-gray-300 text-gray-500',
    failed: 'bg-red-500 text-white',
    awaiting: 'bg-yellow-500 text-white',
  };

  const statusLabels = {
    completed: 'Completed',
    in_progress: 'In Progress',
    pending: 'Pending',
    failed: 'Failed',
    awaiting: 'Awaiting Action',
  };

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-5 top-10 h-full w-0.5 bg-border" />
      )}

      {/* Icon */}
      <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${statusStyles[event.status]}`}>
        <Icon className="h-5 w-5" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h4 className="font-semibold text-foreground">{event.title}</h4>
          <Badge
            variant="outline"
            className={`text-xs ${
              event.status === 'completed' ? 'border-green-500 text-green-500' :
              event.status === 'failed' ? 'border-red-500 text-red-500' :
              event.status === 'awaiting' ? 'border-yellow-500 text-yellow-500' :
              event.status === 'in_progress' ? 'border-blue-500 text-blue-500' :
              'border-gray-400 text-gray-400'
            }`}
          >
            {statusLabels[event.status]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{event.description}</p>
        {event.details && (
          <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted/50 px-2 py-1 rounded inline-block">
            {event.details}
          </p>
        )}
        {event.timestamp && (
          <p className="text-xs text-muted-foreground mt-2">
            <Clock className="inline h-3 w-3 mr-1" />
            {format(new Date(event.timestamp), 'PPpp')}
          </p>
        )}
      </div>
    </div>
  );
};

export default function AdminOrderDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const orderId = params.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'superadmin' || !orderId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const orderData = await getOrderById(orderId);
      if (orderData) {
        setOrder(orderData);
        // Fetch distributor info
        const distributorData = await getDistributorById(orderData.distributorId);
        setDistributor(distributorData);
      }
    } catch (error) {
      const errorMessage = (error as Error).message || "An unknown error occurred.";
      toast({
        title: "Error",
        description: `Could not fetch order data. ${errorMessage}`,
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user, orderId]);

  useEffect(() => {
    if (!authLoading && user?.role === 'superadmin') {
      fetchData();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [user, authLoading, fetchData]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard.` });
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You must be a Super Admin to view this page.</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-semibold">Order Not Found</h2>
        <p className="text-muted-foreground mt-2">The order you're looking for doesn't exist.</p>
        <Button onClick={() => router.push('/admin/revenue')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Revenue
        </Button>
      </div>
    );
  }

  const timelineEvents = getTimelineEvents(order, distributor);
  const platformFee = (order.platformFeeAmount || 0) / 100;
  const distributorPayout = order.totalAmount - platformFee;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/revenue')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              Order #{order.orderNumber || order.id.slice(0, 8)}
              <Badge variant="outline" className={`capitalize ${statusColors[order.status]}`}>
                {order.status.replace('_', ' ')}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Created {format(new Date(order.createdAt), 'PPpp')}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Order Activity Timeline
              </CardTitle>
              <CardDescription>
                Complete history of actions and status changes for this order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mt-4">
                {timelineEvents.map((event, index) => (
                  <TimelineItem
                    key={event.id}
                    event={event}
                    isLast={index === timelineEvents.length - 1}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {item.cover_url && (
                            <Image
                              src={item.cover_url}
                              alt={item.title}
                              width={40}
                              height={40}
                              className="rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium">{item.title}</p>
                            <p className="text-sm text-muted-foreground">{item.artist}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">€ {formatPriceForDisplay(item.priceAtTimeOfOrder)}</TableCell>
                      <TableCell className="text-right font-medium">
                        € {formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Details */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Order Total</span>
                <span className="font-medium">€ {formatPriceForDisplay(order.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee (4%)</span>
                <span className="font-medium text-green-600">€ {formatPriceForDisplay(platformFee)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Distributor Payout</span>
                <span className="font-medium">€ {formatPriceForDisplay(distributorPayout)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Payment Status</span>
                <Badge variant="outline" className={
                  order.paymentStatus === 'paid' ? 'border-green-500 text-green-500' :
                  order.paymentStatus === 'failed' ? 'border-red-500 text-red-500' :
                  'border-yellow-500 text-yellow-500'
                }>
                  {order.paymentStatus || 'Unpaid'}
                </Badge>
              </div>
              {order.paidAt && (
                <p className="text-xs text-muted-foreground">
                  Paid on {format(new Date(order.paidAt), 'PPp')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">{order.customerName}</p>
                <p className="text-muted-foreground">{order.viewerEmail}</p>
              </div>
              {order.phoneNumber && (
                <p className="text-muted-foreground">{order.phoneNumber}</p>
              )}
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Shipping Address</p>
                <p className="whitespace-pre-line">{order.shippingAddress}</p>
              </div>
              {order.billingAddress && (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Billing Address</p>
                    <p className="whitespace-pre-line">{order.billingAddress}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Distributor Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Distributor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{distributor?.name || 'Unknown'}</p>
                  <p className="text-muted-foreground">{distributor?.contactEmail}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/admin/distributors/${order.distributorId}`)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Stripe Connect</span>
                <Badge variant="outline" className={
                  distributor?.stripeConnectAccountId
                    ? 'border-green-500 text-green-500'
                    : 'border-yellow-500 text-yellow-500'
                }>
                  {distributor?.stripeConnectAccountId ? 'Connected' : 'Not Connected'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Stripe IDs */}
          {(order.stripePaymentIntentId || order.stripeCheckoutSessionId) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Stripe References
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {order.stripePaymentIntentId && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Payment Intent ID</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                        {order.stripePaymentIntentId}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(order.stripePaymentIntentId!, 'Payment Intent ID')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {order.stripeCheckoutSessionId && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Checkout Session ID</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
                        {order.stripeCheckoutSessionId}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(order.stripeCheckoutSessionId!, 'Checkout Session ID')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Shipping Info */}
          {order.status === 'shipped' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Shipping Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {order.carrier && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Carrier</span>
                    <span className="font-medium uppercase">{order.carrier}</span>
                  </div>
                )}
                {order.trackingNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Tracking Number</p>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{order.trackingNumber}</code>
                  </div>
                )}
                {order.trackingUrl && (
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Track Package
                    </a>
                  </Button>
                )}
                {order.shippedAt && (
                  <p className="text-xs text-muted-foreground">
                    Shipped on {format(new Date(order.shippedAt), 'PPp')}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

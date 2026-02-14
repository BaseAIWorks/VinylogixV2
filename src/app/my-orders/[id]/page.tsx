"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getOrderById } from "@/services/order-service";
import { getDistributorById } from "@/services/distributor-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, ArrowLeft, Package, Truck, MapPin, Loader2, Clock, CheckCircle, XCircle, Hourglass } from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";
import { formatPriceForDisplay } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { generateInvoicePdf } from "@/lib/invoice-utils";
import type { Order, OrderStatus, Distributor } from "@/types";
import ProtectedRoute from "@/components/layout/protected-route";

const statusConfig: Record<OrderStatus, { icon: React.ElementType, color: string, label: string }> = {
  pending: { icon: Clock, color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30', label: 'Pending' },
  awaiting_payment: { icon: Clock, color: 'bg-blue-500/20 text-blue-500 border-blue-500/30', label: 'Awaiting Payment' },
  paid: { icon: CheckCircle, color: 'bg-green-500/20 text-green-500 border-green-500/30', label: 'Paid' },
  processing: { icon: Hourglass, color: 'bg-purple-500/20 text-purple-500 border-purple-500/30', label: 'Processing' },
  shipped: { icon: Truck, color: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30', label: 'Shipped' },
  on_hold: { icon: Clock, color: 'bg-orange-500/20 text-orange-500 border-orange-500/30', label: 'On Hold' },
  cancelled: { icon: XCircle, color: 'bg-red-500/20 text-red-500 border-red-500/30', label: 'Cancelled' },
};

export default function ClientOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const orderId = typeof params.id === 'string' ? params.id : '';

  const [order, setOrder] = useState<Order | null>(null);
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId || !user) {
        setIsLoading(false);
        return;
      }

      try {
        const fetchedOrder = await getOrderById(orderId);

        // Verify this order belongs to current user
        if (fetchedOrder && fetchedOrder.viewerId === user.uid) {
          setOrder(fetchedOrder);

          // Fetch distributor info for invoice
          if (fetchedOrder.distributorId) {
            const distributorData = await getDistributorById(fetchedOrder.distributorId);
            if (distributorData) {
              setDistributor(distributorData);
            }
          }
        } else {
          router.push('/my-orders');
        }
      } catch (error) {
        console.error("Failed to fetch order:", error);
        router.push('/my-orders');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, user, router]);

  const handleDownloadInvoice = async () => {
    if (!order || !distributor) {
      toast({ title: "Error", description: "Unable to generate invoice.", variant: "destructive" });
      return;
    }
    try {
      await generateInvoicePdf(order, distributor);
    } catch (error) {
      console.error("Failed to generate invoice:", error);
      toast({ title: "Error", description: "Failed to generate invoice PDF.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProtectedRoute>
    );
  }

  if (!order) {
    return (
      <ProtectedRoute>
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold">Order Not Found</h3>
          <Button onClick={() => router.push('/my-orders')} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Orders
          </Button>
        </div>
      </ProtectedRoute>
    );
  }

  const CurrentStatusIcon = statusConfig[order.status].icon;

  return (
    <ProtectedRoute>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Button onClick={() => router.push('/my-orders')} variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Orders
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Order #{order.orderNumber || order.id.slice(0, 8)}</h1>
            <p className="text-muted-foreground">Placed on {format(new Date(order.createdAt), 'PPP')}</p>
          </div>
          <Button onClick={handleDownloadInvoice} variant="outline">
            <Download className="mr-2 h-4 w-4" /> Download Invoice
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-primary" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]"></TableHead>
                      <TableHead>Record</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.items.map(item => (
                      <TableRow key={item.recordId}>
                        <TableCell>
                          <Image
                            src={item.cover_url || 'https://placehold.co/80x80.png'}
                            alt={item.title}
                            width={80}
                            height={80}
                            className="rounded-md aspect-square object-cover"
                          />
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{item.title}</p>
                          <p className="text-sm text-muted-foreground">{item.artist}</p>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">€ {formatPriceForDisplay(item.priceAtTimeOfOrder)}</TableCell>
                        <TableCell className="text-right">€ {formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Separator className="my-4" />
                <div className="space-y-2 text-right">
                  <p className="font-semibold text-lg">Total: € {formatPriceForDisplay(order.totalAmount)}</p>
                  {order.totalWeight && (
                    <p className="text-sm text-muted-foreground">
                      Total Weight: {(order.totalWeight / 1000).toFixed(2)} kg
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Shipping Tracking */}
            {order.trackingNumber && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Truck className="h-5 w-5 text-primary" />
                    Shipping Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Carrier:</span>
                    <span className="font-medium capitalize">{order.carrier || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tracking Number:</span>
                    <span className="font-mono text-sm">{order.trackingNumber}</span>
                  </div>
                  {order.estimatedDeliveryDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Estimated Delivery:</span>
                      <span className="font-medium">{format(new Date(order.estimatedDeliveryDate), 'PPP')}</span>
                    </div>
                  )}
                  {order.trackingUrl && (
                    <Button asChild variant="outline" className="w-full mt-4">
                      <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer">
                        Track Package <Truck className="ml-2 h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {/* Order Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-primary" />
                  Order Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <CurrentStatusIcon className={`h-6 w-6 ${statusConfig[order.status].color.split(' ')[1]}`} />
                  <Badge variant="outline" className={`text-lg ${statusConfig[order.status].color}`}>
                    {statusConfig[order.status].label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Last updated: {format(new Date(order.updatedAt), 'Pp')}
                </p>
                {order.shippedAt && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Shipped: {format(new Date(order.shippedAt), 'Pp')}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  Shipping Address
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-medium">{order.customerName}</p>
                {order.phoneNumber && <p className="text-muted-foreground">{order.phoneNumber}</p>}
                <Separator className="my-2" />
                <p className="text-muted-foreground whitespace-pre-wrap">{order.shippingAddress}</p>
              </CardContent>
            </Card>

            {/* Payment Info */}
            {order.paymentStatus === 'paid' && order.paidAt && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Payment Confirmed
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-medium">€{formatPriceForDisplay(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid On:</span>
                    <span>{format(new Date(order.paidAt), 'PPP')}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

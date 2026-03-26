
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type { Order, OrderStatus, VinylRecord } from "@/types";
import { getOrderById, updateOrderStatus } from "@/services/order-service";
import { getRecordById } from "@/services/record-service";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Package, User, Receipt, Music, CheckCircle, XCircle, Clock, Weight, Printer, Truck, PackageCheck, Hourglass, DollarSign, FileDown, ThumbsUp, ThumbsDown, Send } from "lucide-react";
import { auth } from "@/lib/firebase";
import { format } from "date-fns";
import Image from "next/image";
import { formatPriceForDisplay, checkBusinessProfileComplete } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { generateInvoicePdf } from "@/lib/invoice-utils";


const statusConfig: Record<OrderStatus, { icon: React.ElementType, color: string, label: string }> = {
    awaiting_approval: { icon: Clock, color: 'bg-amber-500/20 text-amber-500 border-amber-500/30', label: 'Awaiting Approval' },
    pending: { icon: Clock, color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30', label: 'Pending' },
    awaiting_payment: { icon: Receipt, color: 'bg-blue-500/20 text-blue-500 border-blue-500/30', label: 'Awaiting Payment' },
    paid: { icon: CheckCircle, color: 'bg-green-500/20 text-green-500 border-green-500/30', label: 'Paid' },
    processing: { icon: Hourglass, color: 'bg-purple-500/20 text-purple-500 border-purple-500/30', label: 'Processing' },
    shipped: { icon: Truck, color: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30', label: 'Shipped' },
    on_hold: { icon: Clock, color: 'bg-orange-500/20 text-orange-500 border-orange-500/30', label: 'On Hold' },
    cancelled: { icon: XCircle, color: 'bg-red-500/20 text-red-500 border-red-500/30', label: 'Cancelled' },
};

type PackingSlipItem = {
    recordId: string;
    title: string;
    artist: string;
    quantity: number;
    weight?: number;
    shelf_locations?: string[];
    storage_locations?: string[];
};

export default function OrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { user, activeDistributor } = useAuth();
    const orderId = typeof params.id === 'string' ? params.id : '';
    
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [packingSlipItems, setPackingSlipItems] = useState<PackingSlipItem[]>([]);
    const [isLoadingPackingSlip, setIsLoadingPackingSlip] = useState(false);

    const fetchOrder = useCallback(async () => {
        if (!orderId || !user) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const fetchedOrder = await getOrderById(orderId);
            if (fetchedOrder && (fetchedOrder.distributorId === user.distributorId || user.role === 'superadmin')) {
                setOrder(fetchedOrder);
            } else {
                toast({ title: "Not Found", description: "The requested order could not be found.", variant: "destructive" });
                router.push('/orders');
            }
        } catch (error) {
            console.error("Failed to fetch order:", error);
            toast({ title: "Error", description: "Could not load order details.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [orderId, router, toast, user]);

    useEffect(() => {
        fetchOrder();
    }, [fetchOrder]);

    const businessProfileStatus = checkBusinessProfileComplete(activeDistributor);

    const handleStatusUpdate = async (newStatus: OrderStatus) => {
        if (!order || !user) return;

        // Block processing/shipped if business profile is incomplete
        if ((newStatus === 'processing' || newStatus === 'shipped') && !businessProfileStatus.isComplete) {
            toast({
                title: "Business Profile Incomplete",
                description: `Please complete your business profile before processing orders. Missing: ${businessProfileStatus.missingFields.join(', ')}`,
                variant: "destructive",
            });
            return;
        }

        setIsUpdating(true);
        try {
            const updatedOrder = await updateOrderStatus(order.id, newStatus, user);
            if(updatedOrder) {
              setOrder(updatedOrder);
              toast({ title: "Status Updated", description: `Order status changed to ${statusConfig[newStatus].label}.` });
            }
        } catch (error) {
            console.error("Failed to update status:", error);
            toast({ title: "Update Failed", description: (error as Error).message || "Could not update the order status.", variant: "destructive" });
        } finally {
            setIsUpdating(false);
        }
    };
    
    const generatePackingSlip = async () => {
        if (!order) return;
        setIsLoadingPackingSlip(true);
        try {
            const itemsWithLocations: PackingSlipItem[] = await Promise.all(
                order.items.map(async (item) => {
                    let record: VinylRecord | undefined;
                    try {
                        record = await getRecordById(item.recordId);
                    } catch (err) {
                        console.warn(`Could not fetch record ${item.recordId}:`, err);
                    }
                    return {
                        recordId: item.recordId,
                        title: item.title,
                        artist: item.artist,
                        quantity: item.quantity,
                        weight: record?.weight,
                        shelf_locations: record?.shelf_locations,
                        storage_locations: record?.storage_locations,
                    };
                })
            );
            setPackingSlipItems(itemsWithLocations);
        } catch (error) {
            console.error('Packing slip generation failed:', error);
            toast({ title: "Error", description: "Could not generate packing slip.", variant: "destructive" });
        } finally {
            setIsLoadingPackingSlip(false);
        }
    };

    const handlePrintPackingSlip = () => {
        const printContent = document.getElementById('packing-slip-content');
        if (!printContent) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html><head><title>Packing Slip - ${order?.orderNumber || ''}</title>
            <style>
                body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #111; }
                h1 { font-size: 18px; margin-bottom: 4px; }
                h2 { font-size: 14px; color: #666; margin-bottom: 16px; font-weight: normal; }
                table { width: 100%; border-collapse: collapse; font-size: 13px; }
                th { text-align: left; padding: 8px 6px; border-bottom: 2px solid #ddd; font-weight: 600; }
                td { padding: 6px; border-bottom: 1px solid #eee; }
                .weight { font-size: 12px; color: #666; margin-top: 12px; }
                .footer { margin-top: 20px; font-size: 11px; color: #999; }
                @media print { body { padding: 0; } }
            </style></head><body>
            <h1>Packing Slip — ${order?.orderNumber || ''}</h1>
            <h2>${order?.customerName || ''} · ${format(new Date(order?.createdAt || ''), 'dd MMM yyyy')}</h2>
            ${printContent.innerHTML}
            ${order?.totalWeight ? `<p class="weight">Total weight: ${(order.totalWeight / 1000).toFixed(2)} kg</p>` : ''}
            <p class="footer">Printed ${format(new Date(), 'dd MMM yyyy HH:mm')}</p>
            </body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    };
    
    const [isApproving, setIsApproving] = useState(false);

    const handleApproveOrder = async () => {
        if (!order || !user) return;
        setIsApproving(true);
        try {
            // Update status to awaiting_payment
            const updatedOrder = await updateOrderStatus(order.id, 'awaiting_payment', user);
            if (!updatedOrder) {
                toast({ title: "Error", description: "Could not update order status.", variant: "destructive" });
                setIsApproving(false);
                return;
            }
            setOrder(updatedOrder);

            // Generate payment link
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/stripe/payment-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ orderId: order.id }),
            });
            const data = await res.json();

            if (res.ok && data.paymentLink) {
                toast({ title: "Order Approved", description: "Payment link generated. The client can now pay via their orders page." });
            } else {
                toast({ title: "Approved", description: "Order approved but payment link could not be generated. The client can pay manually." });
            }
            fetchOrder();
        } catch (error) {
            console.error('Failed to approve order:', error);
            toast({ title: "Error", description: "Could not approve order.", variant: "destructive" });
        } finally {
            setIsApproving(false);
        }
    };

    const handleRejectOrder = async () => {
        if (!order || !user) return;
        try {
            const updatedOrder = await updateOrderStatus(order.id, 'cancelled', user);
            if (updatedOrder) setOrder(updatedOrder);
            toast({ title: "Order Rejected", description: "The order has been cancelled." });
        } catch (error) {
            toast({ title: "Error", description: "Could not reject order.", variant: "destructive" });
        }
    };

    const handleDownloadInvoice = async () => {
        if (!order || !activeDistributor) {
            toast({ title: "Error", description: "Unable to generate invoice. Distributor information not available.", variant: "destructive" });
            return;
        }
        try {
            await generateInvoicePdf(order, activeDistributor);
        } catch (error) {
            console.error("Failed to generate invoice:", error);
            toast({ title: "Error", description: "Failed to generate invoice PDF.", variant: "destructive" });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="text-center py-12">
                <h3 className="text-xl font-semibold">Order Not Found</h3>
                <Button onClick={() => router.push('/orders')} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Orders
                </Button>
            </div>
        );
    }
    
    const CurrentStatusIcon = statusConfig[order.status].icon;
    const canManageOrder = user?.role === 'master' || (user?.role === 'worker' && !!user.permissions?.canManageOrders);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <Button onClick={() => router.push('/orders')} variant="outline" size="sm" className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Orders
                    </Button>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Order #{order.orderNumber || order.id.slice(0, 8)}</h2>
                    <p className="text-muted-foreground">Details for order placed on {format(new Date(order.createdAt), 'PPP')}.</p>
                </div>
                {canManageOrder && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" onClick={handleDownloadInvoice}><FileDown className="mr-2 h-4 w-4" /> Download Invoice</Button>
                        <Dialog onOpenChange={(open) => { if(open) generatePackingSlip() }}>
                            <DialogTrigger asChild>
                                <Button variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Packing Slip</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <DialogTitle>Packing Slip — #{order.orderNumber}</DialogTitle>
                                            <DialogDescription>{order.customerName} · {format(new Date(order.createdAt), 'dd MMM yyyy')}</DialogDescription>
                                        </div>
                                        {!isLoadingPackingSlip && packingSlipItems.length > 0 && (
                                            <Button size="sm" onClick={handlePrintPackingSlip}>
                                                <Printer className="mr-2 h-4 w-4" /> Print
                                            </Button>
                                        )}
                                    </div>
                                </DialogHeader>
                                {isLoadingPackingSlip ? (
                                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>
                                ) : (
                                    <div id="packing-slip-content" className="max-h-[70vh] overflow-y-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Item</TableHead>
                                                    <TableHead className="text-center">Qty</TableHead>
                                                    <TableHead>Shelf</TableHead>
                                                    <TableHead>Storage</TableHead>
                                                    <TableHead className="text-right">Weight</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {packingSlipItems.map(item => (
                                                    <TableRow key={item.recordId}>
                                                        <TableCell>
                                                            <p className="font-medium">{item.artist}</p>
                                                            <p className="text-sm text-muted-foreground">{item.title}</p>
                                                        </TableCell>
                                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                                        <TableCell>{item.shelf_locations?.join(', ') || '-'}</TableCell>
                                                        <TableCell>{item.storage_locations?.join(', ') || '-'}</TableCell>
                                                        <TableCell className="text-right text-sm">
                                                            {item.weight ? `${((item.weight * item.quantity) / 1000).toFixed(2)} kg` : '-'}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                        {order.totalWeight > 0 && (
                                            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t text-sm">
                                                <Weight className="h-4 w-4 text-muted-foreground" />
                                                <span className="text-muted-foreground">Total weight:</span>
                                                <span className="font-semibold">{(order.totalWeight / 1000).toFixed(2)} kg</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>
                        {order.status === 'awaiting_approval' && (
                            <>
                                <Button onClick={handleApproveOrder} disabled={isApproving || isUpdating} className="bg-green-600 hover:bg-green-700">
                                    {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
                                    Approve & Send Payment Link
                                </Button>
                                <Button variant="destructive" onClick={handleRejectOrder} disabled={isApproving || isUpdating}>
                                    <ThumbsDown className="mr-2 h-4 w-4" /> Reject Order
                                </Button>
                            </>
                        )}
                        {(order.status === 'pending' || order.status === 'awaiting_payment') && <Button onClick={() => handleStatusUpdate('paid')} disabled={isUpdating}><DollarSign className="mr-2 h-4 w-4"/> Mark as Paid</Button>}
                        {order.status === 'paid' && <Button onClick={() => handleStatusUpdate('processing')} disabled={isUpdating}><PackageCheck className="mr-2 h-4 w-4"/> Start Processing</Button>}
                        {order.status === 'processing' && <Button onClick={() => handleStatusUpdate('shipped')} disabled={isUpdating}><Truck className="mr-2 h-4 w-4"/> Mark as Shipped</Button>}
                        {order.status !== 'cancelled' && <Button variant="destructive" onClick={() => handleStatusUpdate('cancelled')} disabled={isUpdating}>Cancel Order</Button>}
                        {isUpdating && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3"><Music className="h-6 w-6 text-primary" />Items in this Order</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[64px]"></TableHead>
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
                                                <Image src={item.cover_url || 'https://placehold.co/64x64.png'} alt={item.title} width={64} height={64} className="rounded-md aspect-square object-cover" data-ai-hint="album cover"/>
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
                                {order.totalWeight && <p className="text-sm text-muted-foreground">Total Weight: {(order.totalWeight / 1000).toFixed(2)} kg</p>}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-6">
                    <Card>
                         <CardHeader>
                            <CardTitle className="flex items-center gap-3"><Package className="h-6 w-6 text-primary" />Order Status</CardTitle>
                         </CardHeader>
                         <CardContent>
                            <div className="flex items-center gap-3">
                              <CurrentStatusIcon className={`h-6 w-6 ${statusConfig[order.status].color.split(' ')[1]}`} />
                              <Badge variant="outline" className={`text-lg ${statusConfig[order.status].color}`}>
                                {statusConfig[order.status].label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Last updated: {format(new Date(order.updatedAt), 'Pp')}</p>
                         </CardContent>
                    </Card>
                     <Card>
                         <CardHeader>
                            <CardTitle className="flex items-center gap-3"><User className="h-6 w-6 text-primary" />Customer Details</CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-2 text-sm">
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-muted-foreground">{order.viewerEmail}</p>
                            <p className="text-muted-foreground">{order.phoneNumber}</p>
                            <Separator className="my-3"/>
                            <p className="font-medium">Shipping Address</p>
                            <p className="text-muted-foreground whitespace-pre-wrap">{order.shippingAddress}</p>
                         </CardContent>
                    </Card>

                    {/* Payment Details Card */}
                    {order.paymentStatus === 'paid' && order.platformFeeAmount && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <DollarSign className="h-6 w-6 text-green-500" />
                                    Payment Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Order Total:</span>
                                    <span className="font-medium">€{formatPriceForDisplay(order.totalAmount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Platform Fee (4%):</span>
                                    <span className="text-red-600">-€{formatPriceForDisplay(order.platformFeeAmount / 100)}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between">
                                    <span className="font-semibold">Your Payout:</span>
                                    <span className="font-semibold text-green-600">
                                        €{formatPriceForDisplay(order.totalAmount - (order.platformFeeAmount / 100))}
                                    </span>
                                </div>
                                {order.paidAt && (
                                    <p className="text-xs text-muted-foreground pt-2">
                                        Paid on {format(new Date(order.paidAt), 'PPP')}
                                    </p>
                                )}
                                {order.stripePaymentIntentId && (
                                    <div className="pt-2">
                                        <p className="text-xs text-muted-foreground mb-1">Payment ID:</p>
                                        <code className="text-xs bg-muted px-2 py-1 rounded">
                                            {order.stripePaymentIntentId}
                                        </code>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}

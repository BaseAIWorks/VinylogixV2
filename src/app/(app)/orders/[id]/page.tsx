
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
import { Loader2, ArrowLeft, Package, User, Receipt, Music, CheckCircle, XCircle, Clock, Weight, Printer, Truck, PackageCheck, Hourglass, DollarSign, FileDown } from "lucide-react";
import { format } from "date-fns";
import Image from "next/image";
import { formatPriceForDisplay } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import jsPDF from "jspdf";
import "jspdf-autotable";


const statusConfig: Record<OrderStatus, { icon: React.ElementType, color: string, label: string }> = {
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
    shelf_locations?: string[];
    storage_locations?: string[];
};

export default function OrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuth();
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

    const handleStatusUpdate = async (newStatus: OrderStatus) => {
        if (!order || !user) return;
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
                    const record = await getRecordById(item.recordId);
                    return {
                        recordId: item.recordId,
                        title: item.title,
                        artist: item.artist,
                        quantity: item.quantity,
                        shelf_locations: record?.shelf_locations,
                        storage_locations: record?.storage_locations,
                    };
                })
            );
            setPackingSlipItems(itemsWithLocations);
        } catch (error) {
            toast({ title: "Error", description: "Could not generate packing slip.", variant: "destructive" });
        } finally {
            setIsLoadingPackingSlip(false);
        }
    };
    
     const generateInvoicePdf = () => {
        if (!order) return;

        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("INVOICE", 150, 20);

        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text(`Order #: ${order.orderNumber || order.id.slice(0, 8)}`, 150, 28);
        doc.text(`Date: ${format(new Date(order.createdAt), 'PPP')}`, 150, 34);

        // Client Info
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Bill To:", 14, 50);
        doc.setFont("helvetica", "normal");
        doc.text(order.customerName, 14, 56);
        doc.text(order.shippingAddress.split('\n'), 14, 62);
        
        // Status Badge
        doc.setFillColor(230, 230, 230); // A light grey
        doc.setDrawColor(150, 150, 150);
        const statusText = statusConfig[order.status].label;
        const statusWidth = doc.getStringUnitWidth(statusText) * doc.getFontSize() / doc.internal.scaleFactor + 10;
        doc.roundedRect(14, 80, statusWidth, 10, 3, 3, 'FD');
        doc.text(statusText, 19, 87);

        // Order Items Table
        const tableColumn = ["#", "Item", "Qty", "Unit Price", "Total"];
        const tableRows = order.items.map((item, index) => [
            index + 1,
            `${item.title}\n${item.artist}`,
            item.quantity,
            `€${formatPriceForDisplay(item.priceAtTimeOfOrder)}`,
            `€${formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}`
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 95,
            theme: 'striped',
            headStyles: { fillColor: [38, 34, 43] },
            didDrawCell: (data: any) => {
              // Your cell drawing logic if needed
            }
        });
        
        // Totals
        const finalY = (doc as any).lastAutoTable.finalY || 150;
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Total:", 150, finalY + 15, { align: 'right' });
        doc.text(`€${formatPriceForDisplay(order.totalAmount)}`, 200, finalY + 15, { align: 'right' });

        // Footer
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text("Thank you for your order!", 105, 285, { align: 'center' });

        doc.save(`Invoice-${order.orderNumber || order.id.slice(0, 8)}.pdf`);
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
                        <Button variant="outline" onClick={generateInvoicePdf}><FileDown className="mr-2 h-4 w-4" /> Download Invoice</Button>
                        <Dialog onOpenChange={(open) => { if(open) generatePackingSlip() }}>
                            <DialogTrigger asChild>
                                <Button variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Packing Slip</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                                <DialogHeader>
                                    <DialogTitle>Packing Slip for Order #{order.orderNumber}</DialogTitle>
                                    <DialogDescription>Items and their locations for picking.</DialogDescription>
                                </DialogHeader>
                                {isLoadingPackingSlip ? (
                                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>
                                ) : (
                                    <div className="max-h-[70vh] overflow-y-auto">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Shelf Locations</TableHead><TableHead>Storage Locations</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {packingSlipItems.map(item => (
                                                    <TableRow key={item.recordId}>
                                                        <TableCell><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.artist}</p></TableCell>
                                                        <TableCell>{item.quantity}</TableCell>
                                                        <TableCell>{item.shelf_locations?.join(', ') || '-'}</TableCell>
                                                        <TableCell>{item.storage_locations?.join(', ') || '-'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>
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
                </div>
            </div>
        </div>
    )
}

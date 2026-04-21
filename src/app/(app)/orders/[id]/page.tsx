
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import type { Order, OrderStatus, OrderItemStatus, VinylRecord } from "@/types";
import { getOrderById, updateOrderStatus, updateOrderItemStatuses, recalculateOrderPriceAndTax, getOrdersByViewerId } from "@/services/order-service";
import { getRecordById } from "@/services/record-service";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Package, User, Receipt, Music, CheckCircle, XCircle, Clock, Weight, Printer, Truck, PackageCheck, Hourglass, DollarSign, FileDown, ThumbsUp, ThumbsDown, Send, Building2, Mail, Phone, MapPin, ShoppingCart, AlertCircle, ExternalLink, Save, Bell, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { format } from "date-fns";
import Image from "next/image";
import { formatPriceForDisplay, checkBusinessProfileComplete } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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

const itemStatusConfig: Record<OrderItemStatus, { label: string; color: string }> = {
    available: { label: 'Available', color: 'bg-green-500/20 text-green-700 border-green-500/30' },
    not_available: { label: 'Not Available', color: 'bg-red-500/20 text-red-700 border-red-500/30' },
    out_of_stock: { label: 'Out of Stock', color: 'bg-orange-500/20 text-orange-700 border-orange-500/30' },
    back_order: { label: 'Back Order', color: 'bg-amber-500/20 text-amber-700 border-amber-500/30' },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    bank_transfer: 'Bank transfer',
    cash: 'Cash',
    paypal_external: 'PayPal (direct)',
    stripe_external: 'Stripe (external)',
    stripe: 'Stripe',
    paypal: 'PayPal',
    other: 'Other',
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
    const [customerStats, setCustomerStats] = useState<{ totalOrders: number; totalSpent: number; openPayments: number } | null>(null);

    // Item status & quantity management
    const [itemStatusChanges, setItemStatusChanges] = useState<Record<string, OrderItemStatus>>({});
    const [itemQuantityChanges, setItemQuantityChanges] = useState<Record<string, number>>({});
    const [isSavingItemStatuses, setIsSavingItemStatuses] = useState(false);
    const [isSendingNotification, setIsSendingNotification] = useState(false);
    const [isEmailingInvoice, setIsEmailingInvoice] = useState(false);
    const [isRegeneratingPaymentLink, setIsRegeneratingPaymentLink] = useState(false);
    const [isMarkingPaid, setIsMarkingPaid] = useState(false);
    const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
    const [markPaidMethod, setMarkPaidMethod] = useState<'bank_transfer' | 'cash' | 'paypal_external' | 'stripe_external' | 'other'>('bank_transfer');
    const [markPaidReference, setMarkPaidReference] = useState('');
    const [markPaidNotes, setMarkPaidNotes] = useState('');
    const [markPaidSendEmail, setMarkPaidSendEmail] = useState(true);

    const [isSendingReminder, setIsSendingReminder] = useState(false);

    // Shipping dialog state
    const [shipDialogOpen, setShipDialogOpen] = useState(false);
    const [isSavingShipping, setIsSavingShipping] = useState(false);
    const [isResendingTracking, setIsResendingTracking] = useState(false);
    const [shipCarrier, setShipCarrier] = useState<'postnl' | 'dhl' | 'ups' | 'fedex' | 'dpd' | 'gls' | 'other'>('postnl');
    const [shipInput, setShipInput] = useState<string>('');
    const [shipEta, setShipEta] = useState<string>('');
    const [shipSendEmail, setShipSendEmail] = useState<boolean>(true);
    const [shipWarning, setShipWarning] = useState<string | null>(null);

    // Refund state
    const [refundDialogOpen, setRefundDialogOpen] = useState(false);
    const [isRefunding, setIsRefunding] = useState(false);
    const [refundAmount, setRefundAmount] = useState<string>('');
    const [refundReason, setRefundReason] = useState<string>('');
    const [refundMethod, setRefundMethod] = useState<'stripe' | 'paypal' | 'bank_transfer' | 'cash' | 'other'>('bank_transfer');
    const [refundNotes, setRefundNotes] = useState<string>('');

    const [isRecalculating, setIsRecalculating] = useState(false);
    const [shippingCostInput, setShippingCostInput] = useState<string>('');
    const [showShipping, setShowShipping] = useState<boolean>(false);

    // Discount state — mirrors Order.discountType/discountValue. Toggle off =
    // discount cleared when distributor clicks Recalculate.
    const [showDiscount, setShowDiscount] = useState<boolean>(false);
    const [discountType, setDiscountType] = useState<'fixed' | 'percent'>('fixed');
    const [discountInput, setDiscountInput] = useState<string>('');
    const hasUnsavedItemChanges = Object.keys(itemStatusChanges).length > 0 || Object.keys(itemQuantityChanges).length > 0;
    const hasItemStatusChanges = order?.items.some(item => item.itemStatus && item.itemStatus !== 'available') ?? false;
    const itemChangesNotifiedAt = order?.itemChangesNotifiedAt;
    const invoiceEmailedAt = order?.invoiceEmailedAt;

    // Payment link state — a link is "active" if we have a URL, the order isn't paid,
    // and Stripe's 24h expiry hasn't passed. Stale means the order was modified after
    // the link was created (i.e. items / totals may no longer match the link).
    const paymentLinkExpiresAt = order?.paymentLinkExpiresAt;
    const paymentLinkCreatedAt = order?.paymentLinkCreatedAt;
    const hasPaymentLink = !!order?.paymentLink;
    const paymentLinkExpired = paymentLinkExpiresAt ? new Date(paymentLinkExpiresAt) < new Date() : false;
    const hasActivePaymentLink = hasPaymentLink && !paymentLinkExpired && order?.paymentStatus !== 'paid';
    const isPaymentLinkStale = hasActivePaymentLink && paymentLinkCreatedAt && order?.updatedAt
      && new Date(order.updatedAt).getTime() - new Date(paymentLinkCreatedAt).getTime() > 5_000; // >5s diff
    // "Needs (re-)notification" when the order was modified AFTER the last notification,
    // or when no notification was sent yet.
    const needsItemChangesNotification = hasItemStatusChanges && (
      !itemChangesNotifiedAt || (order?.updatedAt && new Date(order.updatedAt) > new Date(itemChangesNotifiedAt))
    );

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
                // Hydrate local input state from the fetched order. Toggles
                // auto-open when the order already carries a non-zero value,
                // so distributors can see/edit what's applied without manual
                // clicks.
                const savedShipping = fetchedOrder.shippingCost || 0;
                setShippingCostInput(savedShipping > 0 ? savedShipping.toString() : '');
                setShowShipping(savedShipping > 0);
                const savedDiscountType = fetchedOrder.discountType;
                const savedDiscountValue = fetchedOrder.discountValue;
                if (savedDiscountType && typeof savedDiscountValue === 'number' && savedDiscountValue > 0) {
                    setDiscountType(savedDiscountType);
                    setDiscountInput(savedDiscountValue.toString());
                    setShowDiscount(true);
                } else {
                    setDiscountInput('');
                    setShowDiscount(false);
                }
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

    // Fetch customer order stats
    useEffect(() => {
        if (!order?.viewerId) return;
        getOrdersByViewerId(order.viewerId).then(orders => {
            const paidStatuses = ['paid', 'processing', 'shipped'];
            const paidOrders = orders.filter(o => paidStatuses.includes(o.status));
            const totalSpent = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);
            const openPayments = orders.filter(o => o.status === 'awaiting_payment' || o.status === 'awaiting_approval').length;
            setCustomerStats({ totalOrders: orders.length, totalSpent, openPayments });
        }).catch(() => setCustomerStats(null));
    }, [order?.viewerId]);

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
    const [isApprovingInvoiceOnly, setIsApprovingInvoiceOnly] = useState(false);

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
                toast({ title: "Order Approved", description: "Payment link generated and emailed to the client." });
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

    const handleApproveInvoiceOnly = async () => {
        if (!order) return;
        setIsApprovingInvoiceOnly(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/orders/${order.id}/approve-invoice-only`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Request failed');
            }
            toast({
                title: 'Order approved',
                description: `Invoice emailed to ${order.viewerEmail}. No Stripe link sent — client will pay externally, then you mark as paid.`,
            });
            fetchOrder();
        } catch (error: any) {
            console.error('Failed to approve (invoice-only):', error);
            toast({
                title: 'Error',
                description: error?.message || 'Failed to approve order.',
                variant: 'destructive',
            });
        } finally {
            setIsApprovingInvoiceOnly(false);
        }
    };

    const handleRejectOrder = async () => {
        if (!order || !user) return;
        try {
            const updatedOrder = await updateOrderStatus(order.id, 'cancelled', user);
            if (updatedOrder) setOrder(updatedOrder);
            // Send rejection email (non-blocking, server action)
            try {
                const { sendOrderRejectedEmail } = await import('@/services/email-service');
                sendOrderRejectedEmail(order).catch(() => {});
            } catch {}
            toast({ title: "Order Rejected", description: "The order has been cancelled and the client has been notified." });
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

    const handleEmailInvoice = async () => {
        if (!order) return;
        if (!order.viewerEmail) {
            toast({ title: "Missing email", description: "This order has no customer email address.", variant: "destructive" });
            return;
        }
        setIsEmailingInvoice(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/orders/${order.id}/send-invoice`, {
                method: 'POST',
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Request failed');
            }
            toast({ title: "Invoice emailed", description: `Sent to ${order.viewerEmail}` });
            fetchOrder();
        } catch (error: any) {
            console.error("Failed to email invoice:", error);
            toast({ title: "Error", description: error?.message || "Failed to email invoice.", variant: "destructive" });
        } finally {
            setIsEmailingInvoice(false);
        }
    };

    const handleItemStatusChange = (recordId: string, newStatus: OrderItemStatus) => {
        const currentSavedStatus = order?.items.find(i => i.recordId === recordId)?.itemStatus || 'available';
        if (newStatus === currentSavedStatus) {
            // Revert to saved — remove from pending changes
            setItemStatusChanges(prev => {
                const next = { ...prev };
                delete next[recordId];
                return next;
            });
        } else {
            setItemStatusChanges(prev => ({ ...prev, [recordId]: newStatus }));
        }
    };

    const handleItemQuantityChange = (recordId: string, newQuantity: number) => {
        const originalQty = order?.items.find(i => i.recordId === recordId)?.quantity || 1;
        if (newQuantity === originalQty) {
            setItemQuantityChanges(prev => { const next = { ...prev }; delete next[recordId]; return next; });
        } else if (newQuantity >= 1) {
            setItemQuantityChanges(prev => ({ ...prev, [recordId]: newQuantity }));
        }
    };

    const handleSaveItemStatuses = async () => {
        if (!order || !user || !hasUnsavedItemChanges) return;
        // Warn the distributor that an active Stripe payment link will no longer
        // match the order after saving. Link isn't auto-invalidated here — they
        // must click "Regenerate Payment Link" afterwards (the button appears).
        if (hasActivePaymentLink) {
            const ok = window.confirm(
                'This order has an active Stripe payment link. Saving these changes will make that link out-of-date (it still charges the old total). After saving, click "Regenerate Payment Link" to invalidate the old link and send the customer a new one. Continue?'
            );
            if (!ok) return;
        }
        setIsSavingItemStatuses(true);
        try {
            // Merge status and quantity changes per item
            const allRecordIds = new Set([...Object.keys(itemStatusChanges), ...Object.keys(itemQuantityChanges)]);
            const changes = Array.from(allRecordIds).map(recordId => ({
                recordId,
                itemStatus: itemStatusChanges[recordId] || order.items.find(i => i.recordId === recordId)?.itemStatus || 'available' as OrderItemStatus,
                quantity: itemQuantityChanges[recordId],
            }));
            const updatedOrder = await updateOrderItemStatuses(orderId, changes, user);
            setOrder(updatedOrder);
            setItemStatusChanges({});
            setItemQuantityChanges({});
            toast({ title: "Order items updated", description: "Quantities and statuses saved. Totals recalculated." });
        } catch (error) {
            toast({ title: "Error", description: "Failed to update order items.", variant: "destructive" });
        } finally {
            setIsSavingItemStatuses(false);
        }
    };

    const handleNotifyClient = async () => {
        if (!order) return;
        setIsSendingNotification(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/orders/${order.id}/notify-item-changes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Request failed');
            }
            toast({ title: "Client notified", description: `Email sent to ${order.viewerEmail}` });
            fetchOrder();
        } catch (error: any) {
            console.error("Failed to send notification:", error);
            toast({ title: "Error", description: error?.message || "Failed to send notification email.", variant: "destructive" });
        } finally {
            setIsSendingNotification(false);
        }
    };

    const handleMarkPaidSubmit = async () => {
        if (!order) return;
        setIsMarkingPaid(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/orders/${order.id}/mark-paid`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    paymentMethod: markPaidMethod,
                    paymentReference: markPaidReference.trim() || undefined,
                    paymentNotes: markPaidNotes.trim() || undefined,
                    sendConfirmationEmail: markPaidSendEmail,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Request failed');
            }
            toast({
                title: 'Marked as paid',
                description: markPaidSendEmail
                    ? `Order marked paid and confirmation sent to ${order.viewerEmail}.`
                    : 'Order marked paid. No customer email was sent.',
            });
            setMarkPaidDialogOpen(false);
            setMarkPaidReference('');
            setMarkPaidNotes('');
            fetchOrder();
        } catch (error: any) {
            console.error('Failed to mark as paid:', error);
            toast({
                title: 'Error',
                description: error?.message || 'Failed to mark order as paid.',
                variant: 'destructive',
            });
        } finally {
            setIsMarkingPaid(false);
        }
    };

    // Prefill the ship dialog whenever it opens for an already-shipped order,
    // so edits start from the existing info instead of blank.
    useEffect(() => {
        if (!shipDialogOpen || !order) return;
        setShipWarning(null);
        if (order.carrier) setShipCarrier(order.carrier as any);
        setShipInput(order.trackingNumber || '');
        setShipEta(order.estimatedDeliveryDate ? order.estimatedDeliveryDate.slice(0, 10) : '');
        setShipSendEmail(!order.trackingNumber); // first-time = default on; editing = default off
    }, [shipDialogOpen, order]);

    const handleShipInputChange = async (value: string) => {
        setShipInput(value);
        setShipWarning(null);
        // If the distributor pasted a full URL, auto-detect carrier + number.
        if (/^https?:\/\//i.test(value.trim())) {
            const { parseTrackingInput } = await import('@/lib/shipping-carriers');
            const parsed = parseTrackingInput(value);
            if (parsed) {
                setShipCarrier(parsed.carrier);
                setShipInput(parsed.trackingNumber);
                return;
            }
            setShipWarning("Couldn't recognize that URL. Pick a carrier and paste just the tracking number.");
            return;
        }
        // Soft validation warning based on current carrier
        if (value.trim()) {
            const { validateTrackingNumber } = await import('@/lib/shipping-carriers');
            const check = validateTrackingNumber(shipCarrier, value);
            if (check.warning) setShipWarning(check.warning);
        }
    };

    const handleShipSubmit = async () => {
        if (!order) return;
        const trimmed = shipInput.trim();
        if (!trimmed) {
            toast({ title: "Tracking number required", variant: "destructive" });
            return;
        }
        setIsSavingShipping(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/orders/${order.id}/ship`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    carrier: shipCarrier,
                    trackingNumber: trimmed,
                    estimatedDeliveryDate: shipEta || undefined,
                    sendEmail: shipSendEmail,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Failed to save shipping info");
            toast({
                title: data.action === 'shipped' ? "Marked as shipped" : "Tracking updated",
                description: data.emailed ? `Email sent to ${order.viewerEmail}.` : "No email sent.",
            });
            setShipDialogOpen(false);
            const fetched = await getOrderById(order.id);
            if (fetched) setOrder(fetched);
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to save shipping info.", variant: "destructive" });
        } finally {
            setIsSavingShipping(false);
        }
    };

    const handleResendTrackingEmail = async () => {
        if (!order) return;
        setIsResendingTracking(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/orders/${order.id}/ship`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ resendOnly: true }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Failed to resend tracking email");
            toast({ title: "Email sent", description: `Tracking email resent to ${order.viewerEmail}.` });
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to resend.", variant: "destructive" });
        } finally {
            setIsResendingTracking(false);
        }
    };

    const handleSendReminderNow = async () => {
        if (!order) return;
        setIsSendingReminder(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/orders/${order.id}/send-payment-reminder`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Request failed");
            toast({
                title: "Reminder sent",
                description: `Reminder #${data.reminderCount} emailed to ${order.viewerEmail}.`,
            });
            const fetched = await getOrderById(order.id);
            if (fetched) setOrder(fetched);
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to send reminder.", variant: "destructive" });
        } finally {
            setIsSendingReminder(false);
        }
    };

    const handleRefundSubmit = async () => {
        if (!order) return;
        const amount = parseFloat(refundAmount);
        if (!isFinite(amount) || amount <= 0) {
            toast({ title: "Invalid amount", description: "Enter a positive refund amount.", variant: "destructive" });
            return;
        }
        setIsRefunding(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch(`/api/orders/${order.id}/refund`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    amount,
                    reason: refundReason,
                    method: refundMethod,
                    notes: refundNotes,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error || "Refund failed");
            toast({
                title: data.paymentStatus === "refunded" ? "Fully refunded" : "Refund recorded",
                description: `€${amount.toFixed(2)} recorded.`,
            });
            setRefundDialogOpen(false);
            setRefundAmount("");
            setRefundReason("");
            setRefundNotes("");
            // Reload order data
            const fetched = await getOrderById(order.id);
            if (fetched) setOrder(fetched);
        } catch (err: any) {
            toast({ title: "Error", description: err.message || "Failed to record refund.", variant: "destructive" });
        } finally {
            setIsRefunding(false);
        }
    };

    const handleRegeneratePaymentLink = async () => {
        if (!order) return;
        const notify = window.confirm(
            'Regenerate the Stripe payment link? This will invalidate the current link so the customer can only pay the up-to-date total.\n\nClick OK to also email the new link to the customer, or Cancel to only generate it (you can share it manually).'
        );
        setIsRegeneratingPaymentLink(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/stripe/payment-link/regenerate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ orderId: order.id, notifyCustomer: notify }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || 'Request failed');
            }
            toast({
                title: 'Payment link regenerated',
                description: notify
                    ? `New link created, old link invalidated, and emailed to ${order.viewerEmail}.`
                    : 'New link created, old link invalidated. Share it with the customer manually.',
            });
            fetchOrder();
        } catch (error: any) {
            console.error('Failed to regenerate payment link:', error);
            toast({
                title: 'Error',
                description: error?.message || 'Failed to regenerate payment link.',
                variant: 'destructive',
            });
        } finally {
            setIsRegeneratingPaymentLink(false);
        }
    };

    // Parsed inputs for the pricing card; null if the input is invalid
    const parseNum = (s: string): number | null => {
        const n = parseFloat(s.replace(',', '.'));
        return isNaN(n) ? null : n;
    };

    // True when the distributor has changed discount/shipping inputs vs what's
    // stored on the order. Combined with hasUnsavedItemChanges this gates the
    // send/email/regenerate/approve buttons — we can't ship an invoice that
    // doesn't yet reflect the pending pricing edits.
    const hasPricingInputPending = (() => {
        if (!order) return false;
        const savedShipping = order.shippingCost || 0;
        const savedDiscountValue = order.discountValue || 0;
        const savedDiscountType = order.discountType || 'fixed';

        const shippingNow = showShipping ? (parseNum(shippingCostInput) ?? 0) : 0;
        if (Math.abs(shippingNow - savedShipping) > 0.001) return true;

        const discountNow = showDiscount ? (parseNum(discountInput) ?? 0) : 0;
        if (Math.abs(discountNow - savedDiscountValue) > 0.001) return true;

        if (showDiscount && discountType !== savedDiscountType) return true;

        return false;
    })();

    const isPricingDirty = hasUnsavedItemChanges || hasPricingInputPending;

    const handleRecalculatePriceAndTax = async () => {
        if (!order || !user) return;
        setIsRecalculating(true);
        try {
            // 1. Save item changes first (status / quantity) if pending, so the
            //    recalc runs against the up-to-date items list.
            if (hasUnsavedItemChanges) {
                const allRecordIds = new Set([
                    ...Object.keys(itemStatusChanges),
                    ...Object.keys(itemQuantityChanges),
                ]);
                const changes = Array.from(allRecordIds).map(recordId => ({
                    recordId,
                    itemStatus:
                        itemStatusChanges[recordId] ||
                        order.items.find(i => i.recordId === recordId)?.itemStatus ||
                        ('available' as OrderItemStatus),
                    quantity: itemQuantityChanges[recordId],
                }));
                await updateOrderItemStatuses(orderId, changes, user);
                setItemStatusChanges({});
                setItemQuantityChanges({});
            }

            // 2. Gather pricing inputs
            let shippingOpt: number | undefined;
            if (showShipping) {
                const parsed = parseNum(shippingCostInput);
                if (parsed === null || parsed < 0) {
                    toast({ title: 'Invalid shipping', description: 'Enter a valid non-negative shipping cost.', variant: 'destructive' });
                    setIsRecalculating(false);
                    return;
                }
                shippingOpt = parsed;
            } else {
                shippingOpt = 0;
            }

            let discountOpt: { type: 'fixed' | 'percent'; value: number } | null = null;
            if (showDiscount) {
                const parsed = parseNum(discountInput);
                if (parsed === null || parsed < 0) {
                    toast({ title: 'Invalid discount', description: 'Enter a valid non-negative discount.', variant: 'destructive' });
                    setIsRecalculating(false);
                    return;
                }
                if (parsed > 0) {
                    discountOpt = { type: discountType, value: parsed };
                }
            }

            // 3. Run the full recalc
            const updated = await recalculateOrderPriceAndTax(orderId, user, {
                shippingCost: shippingOpt,
                discount: discountOpt,
            });

            setOrder(updated);
            // Re-sync inputs to what was saved (server may cap / round the values)
            setShippingCostInput(updated.shippingCost ? updated.shippingCost.toString() : '');
            setShowShipping((updated.shippingCost || 0) > 0);
            if (updated.discountType && typeof updated.discountValue === 'number' && updated.discountValue > 0) {
                setDiscountType(updated.discountType);
                setDiscountInput(updated.discountValue.toString());
                setShowDiscount(true);
            } else {
                setDiscountInput('');
                setShowDiscount(false);
            }

            toast({ title: 'Price & tax recalculated', description: 'Order totals updated.' });
        } catch (error: any) {
            toast({ title: 'Error', description: error.message || 'Failed to recalculate.', variant: 'destructive' });
        } finally {
            setIsRecalculating(false);
        }
    };

    const getEffectiveItemStatus = (recordId: string): OrderItemStatus => {
        return itemStatusChanges[recordId] ?? order?.items.find(i => i.recordId === recordId)?.itemStatus ?? 'available';
    };

    const isItemExcluded = (status: OrderItemStatus) => status === 'not_available' || status === 'out_of_stock';

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
            {/* Mark-as-Paid dialog (manual payment flow: bank transfer / cash / external) */}
            <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Mark order as paid</DialogTitle>
                        <DialogDescription>
                            Use this when the customer paid outside Stripe (e.g. bank transfer). This records the payment, deducts stock, and clears any active Stripe payment link.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Payment method</Label>
                            <RadioGroup value={markPaidMethod} onValueChange={(v) => setMarkPaidMethod(v as any)} className="gap-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="bank_transfer" id="pm-bt" /><Label htmlFor="pm-bt" className="font-normal">Bank transfer</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="cash" id="pm-cash" /><Label htmlFor="pm-cash" className="font-normal">Cash</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="paypal_external" id="pm-pp" /><Label htmlFor="pm-pp" className="font-normal">PayPal (direct)</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="stripe_external" id="pm-se" /><Label htmlFor="pm-se" className="font-normal">Stripe (outside this system)</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="other" id="pm-other" /><Label htmlFor="pm-other" className="font-normal">Other</Label></div>
                            </RadioGroup>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mp-ref">Reference <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Input
                                id="mp-ref"
                                value={markPaidReference}
                                onChange={(e) => setMarkPaidReference(e.target.value)}
                                placeholder="Bank transaction ID, memo, etc."
                                maxLength={200}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mp-notes">Internal notes <span className="text-muted-foreground font-normal">(optional, only you see this)</span></Label>
                            <Textarea
                                id="mp-notes"
                                value={markPaidNotes}
                                onChange={(e) => setMarkPaidNotes(e.target.value)}
                                placeholder="Reconciliation notes"
                                maxLength={1000}
                                rows={2}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="mp-email" checked={markPaidSendEmail} onCheckedChange={(v) => setMarkPaidSendEmail(v === true)} />
                            <Label htmlFor="mp-email" className="font-normal text-sm">
                                Email a payment-received confirmation to {order.viewerEmail}
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMarkPaidDialogOpen(false)} disabled={isMarkingPaid}>Cancel</Button>
                        <Button onClick={handleMarkPaidSubmit} disabled={isMarkingPaid}>
                            {isMarkingPaid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DollarSign className="mr-2 h-4 w-4" />}
                            Confirm & Mark Paid
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Refund dialog */}
            <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Record a refund</DialogTitle>
                        <DialogDescription>
                            {(() => {
                                const totalRefunded = (order.refunds || []).reduce((s, r) => s + r.amount, 0);
                                const remaining = order.totalAmount - totalRefunded;
                                return `Already refunded: €${formatPriceForDisplay(totalRefunded)}. Remaining refundable: €${formatPriceForDisplay(remaining)}.`;
                            })()}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="rf-amount">Amount (€)</Label>
                            <Input
                                id="rf-amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={refundAmount}
                                onChange={(e) => setRefundAmount(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Method</Label>
                            <RadioGroup value={refundMethod} onValueChange={(v) => setRefundMethod(v as any)} className="gap-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="bank_transfer" id="rf-bt" /><Label htmlFor="rf-bt" className="font-normal">Bank transfer</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="cash" id="rf-cash" /><Label htmlFor="rf-cash" className="font-normal">Cash</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="stripe" id="rf-stripe" /><Label htmlFor="rf-stripe" className="font-normal">Stripe (record only — process refund manually in dashboard)</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="paypal" id="rf-pp" /><Label htmlFor="rf-pp" className="font-normal">PayPal</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="other" id="rf-other" /><Label htmlFor="rf-other" className="font-normal">Other</Label></div>
                            </RadioGroup>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rf-reason">Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Input
                                id="rf-reason"
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                                placeholder="Damaged item, cancelled, etc."
                                maxLength={500}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rf-notes">Internal notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Textarea
                                id="rf-notes"
                                value={refundNotes}
                                onChange={(e) => setRefundNotes(e.target.value)}
                                placeholder="Bank reference, etc."
                                maxLength={1000}
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRefundDialogOpen(false)} disabled={isRefunding}>Cancel</Button>
                        <Button onClick={handleRefundSubmit} disabled={isRefunding || !refundAmount}>
                            {isRefunding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Record refund
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Shipping info dialog (mark as shipped OR edit tracking info) */}
            <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {order.trackingNumber ? 'Edit tracking info' : 'Mark as shipped'}
                        </DialogTitle>
                        <DialogDescription>
                            {order.trackingNumber
                                ? 'Update carrier or tracking number. Emailing the customer again is optional.'
                                : 'Enter the shipment details. The customer will be emailed a tracking link.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Carrier</Label>
                            <Select value={shipCarrier} onValueChange={(v) => setShipCarrier(v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="postnl">PostNL</SelectItem>
                                    <SelectItem value="dhl">DHL</SelectItem>
                                    <SelectItem value="ups">UPS</SelectItem>
                                    <SelectItem value="fedex">FedEx</SelectItem>
                                    <SelectItem value="dpd">DPD</SelectItem>
                                    <SelectItem value="gls">GLS</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ship-number">Tracking number or URL</Label>
                            <Input
                                id="ship-number"
                                value={shipInput}
                                onChange={(e) => handleShipInputChange(e.target.value)}
                                placeholder="Paste tracking number or the full carrier URL"
                                maxLength={500}
                            />
                            {shipWarning && <p className="text-xs text-amber-600">{shipWarning}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ship-eta">
                                Estimated delivery <span className="text-muted-foreground font-normal">(optional)</span>
                            </Label>
                            <Input
                                id="ship-eta"
                                type="date"
                                value={shipEta}
                                onChange={(e) => setShipEta(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="ship-email" checked={shipSendEmail} onCheckedChange={(v) => setShipSendEmail(v === true)} />
                            <Label htmlFor="ship-email" className="font-normal text-sm">
                                Email tracking info to {order.viewerEmail}
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShipDialogOpen(false)} disabled={isSavingShipping}>Cancel</Button>
                        <Button onClick={handleShipSubmit} disabled={isSavingShipping || !shipInput.trim()}>
                            {isSavingShipping ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Truck className="mr-2 h-4 w-4" />}
                            {order.trackingNumber ? 'Save changes' : 'Mark as shipped'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                        {order.trackingToken && (
                            <Button
                                variant="outline"
                                asChild
                                title="Open the public tracking page your customer sees"
                            >
                                <a href={`/t/${order.trackingToken}`} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" /> Customer view
                                </a>
                            </Button>
                        )}
                        {(order.paymentStatus === 'paid' || order.paymentStatus === 'partially_refunded') && (
                            <Button variant="outline" onClick={() => setRefundDialogOpen(true)}>
                                <RefreshCw className="mr-2 h-4 w-4" /> Record Refund
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleDownloadInvoice}><FileDown className="mr-2 h-4 w-4" /> Download Invoice</Button>
                        <Button variant="outline" onClick={handleEmailInvoice} disabled={isEmailingInvoice || !order.viewerEmail || isPricingDirty} title={isPricingDirty ? 'Recalculate Price + Tax before sending the invoice' : (invoiceEmailedAt ? `Last emailed on ${format(new Date(invoiceEmailedAt), 'dd MMM yyyy HH:mm')}` : 'Email the invoice PDF to the customer')}>
                            {isEmailingInvoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                            {invoiceEmailedAt ? 'Resend Invoice' : 'Email Invoice'}
                        </Button>
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
                                                    <TableHead className="w-[40px]"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {packingSlipItems.map(item => {
                                                    const orderItem = order.items.find(oi => oi.recordId === item.recordId);
                                                    const status = orderItem?.itemStatus || 'available';
                                                    const excluded = isItemExcluded(status);
                                                    return (
                                                    <TableRow key={item.recordId} className={excluded ? 'opacity-60' : ''}>
                                                        <TableCell>
                                                            <p className={`font-medium ${excluded ? 'line-through' : ''}`}>{item.artist}</p>
                                                            <p className="text-sm text-muted-foreground">{item.title}</p>
                                                            {status !== 'available' && (
                                                                <Badge variant="outline" className={`mt-1 text-[10px] ${itemStatusConfig[status].color}`}>
                                                                    {itemStatusConfig[status].label}
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                                        <TableCell>{item.shelf_locations?.join(', ') || '-'}</TableCell>
                                                        <TableCell>{item.storage_locations?.join(', ') || '-'}</TableCell>
                                                        <TableCell className="text-right text-sm">
                                                            {item.weight ? `${((item.weight * item.quantity) / 1000).toFixed(2)} kg` : '-'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Link href={`/records/${item.recordId}`} title="View record">
                                                                <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                                                            </Link>
                                                        </TableCell>
                                                    </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                        {order.totalWeight !== undefined && order.totalWeight > 0 && (
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
                        {order.status === 'awaiting_approval' && (() => {
                            // When Stripe checkout is disabled on the distributor, the
                            // invoice-only path is the only option regardless of the
                            // paymentLinkMode setting — treat it as 'never'.
                            const effectiveMode = activeDistributor?.stripeCheckoutDisabled
                                ? 'never'
                                : (activeDistributor?.paymentLinkMode || 'always');
                            const showStripeButton = effectiveMode !== 'never';
                            const showInvoiceOnlyButton = effectiveMode === 'optional' || effectiveMode === 'never';
                            const busy = isApproving || isApprovingInvoiceOnly || isUpdating;
                            const dirtyTip = 'Recalculate Price + Tax before approving';
                            return (
                                <>
                                    {showStripeButton && (
                                        <Button onClick={handleApproveOrder} disabled={busy || isPricingDirty} className="bg-green-600 hover:bg-green-700" title={isPricingDirty ? dirtyTip : undefined}>
                                            {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
                                            Approve & Send Payment Link
                                        </Button>
                                    )}
                                    {showInvoiceOnlyButton && (
                                        <Button onClick={handleApproveInvoiceOnly} disabled={busy || isPricingDirty} variant={showStripeButton ? 'outline' : 'default'} className={showStripeButton ? '' : 'bg-green-600 hover:bg-green-700'} title={isPricingDirty ? dirtyTip : undefined}>
                                            {isApprovingInvoiceOnly ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
                                            Approve & Send Invoice Only
                                        </Button>
                                    )}
                                    <Button variant="destructive" onClick={handleRejectOrder} disabled={busy}>
                                        <ThumbsDown className="mr-2 h-4 w-4" /> Reject Order
                                    </Button>
                                </>
                            );
                        })()}
                        {(order.status === 'pending' || order.status === 'awaiting_payment') && (
                            <Button onClick={() => setMarkPaidDialogOpen(true)} disabled={isUpdating || isPricingDirty} title={isPricingDirty ? 'Recalculate Price + Tax before marking as paid' : undefined}>
                                <DollarSign className="mr-2 h-4 w-4"/> Mark as Paid
                            </Button>
                        )}
                        {order.status === 'paid' && <Button onClick={() => handleStatusUpdate('processing')} disabled={isUpdating}><PackageCheck className="mr-2 h-4 w-4"/> Start Processing</Button>}
                        {order.status === 'processing' && (
                            <Button onClick={() => setShipDialogOpen(true)} disabled={isUpdating}>
                                <Truck className="mr-2 h-4 w-4"/> Mark as Shipped
                            </Button>
                        )}
                        {order.status === 'shipped' && (
                            <>
                                <Button variant="outline" onClick={() => setShipDialogOpen(true)} disabled={isUpdating}>
                                    <Truck className="mr-2 h-4 w-4"/> Edit tracking info
                                </Button>
                                <Button variant="outline" onClick={handleResendTrackingEmail} disabled={isResendingTracking}>
                                    {isResendingTracking ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Mail className="mr-2 h-4 w-4"/>}
                                    Resend tracking email
                                </Button>
                            </>
                        )}
                        {order.status !== 'cancelled' && <Button variant="destructive" onClick={() => handleStatusUpdate('cancelled')} disabled={isUpdating}>Cancel Order</Button>}
                        {isUpdating && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    {/* Payment amount mismatch — shown when the webhook detected the customer paid a stale link */}
                    {order.paymentAmountMismatch && canManageOrder && (
                        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3 text-red-700 dark:text-red-400">
                                    <AlertCircle className="h-5 w-5" /> Payment Amount Mismatch
                                </CardTitle>
                                <CardDescription className="text-red-700/80 dark:text-red-400/80">
                                    Stripe captured a different amount than the current order total. Order has been put on hold for review.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="text-sm text-red-800 dark:text-red-300 space-y-1">
                                <p><strong>Stripe charged:</strong> € {(order.paymentAmountMismatch.sessionAmountCents / 100).toFixed(2)}</p>
                                <p><strong>Expected (current total):</strong> € {(order.paymentAmountMismatch.expectedAmountCents / 100).toFixed(2)}</p>
                                <p><strong>Difference:</strong> € {((order.paymentAmountMismatch.sessionAmountCents - order.paymentAmountMismatch.expectedAmountCents) / 100).toFixed(2)}</p>
                                <p className="pt-2 text-xs">Reconcile via Stripe Dashboard (partial refund or credit note) and then manually update the order status.</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Payment link status — active / stale / expired */}
                    {/* Hide the Stripe payment-link card entirely when the distributor
                        has opted out of Stripe — even if the order has a legacy
                        paymentLink field set, regenerating would fail guard checks. */}
                    {canManageOrder && hasPaymentLink && order.paymentStatus !== 'paid' && !activeDistributor?.stripeCheckoutDisabled && (
                        <Card className={isPaymentLinkStale ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20' : paymentLinkExpired ? 'border-muted' : 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20'}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <DollarSign className={`h-5 w-5 ${isPaymentLinkStale ? 'text-amber-600' : paymentLinkExpired ? 'text-muted-foreground' : 'text-emerald-600'}`} />
                                    Payment Link
                                    {paymentLinkExpired
                                        ? <Badge variant="outline">Expired</Badge>
                                        : isPaymentLinkStale
                                            ? <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">Out of date</Badge>
                                            : <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">Active</Badge>}
                                </CardTitle>
                                <CardDescription>
                                    {paymentLinkExpired
                                        ? 'The 24-hour payment window has passed. Regenerate to send a new link.'
                                        : isPaymentLinkStale
                                            ? 'This order was modified after the current payment link was created. The link still charges the old total and items — regenerate to sync it with the current order.'
                                            : `Valid until ${paymentLinkExpiresAt ? format(new Date(paymentLinkExpiresAt), 'dd MMM yyyy HH:mm') : 'unknown'}.`}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {order.paymentLink && (
                                    <div className="flex items-center gap-2">
                                        <Input readOnly value={order.paymentLink} className="text-xs font-mono" onClick={(e) => (e.target as HTMLInputElement).select()} />
                                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(order.paymentLink!); toast({ title: 'Copied', description: 'Payment link copied to clipboard.' }); }}>Copy</Button>
                                    </div>
                                )}
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button onClick={handleRegeneratePaymentLink} disabled={isRegeneratingPaymentLink || isPricingDirty} size="sm" variant={isPaymentLinkStale ? 'default' : 'outline'} title={isPricingDirty ? 'Recalculate Price + Tax before regenerating the link' : undefined}>
                                        {isRegeneratingPaymentLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                        Regenerate Payment Link
                                    </Button>
                                    <Button onClick={handleSendReminderNow} disabled={isSendingReminder} size="sm" variant="outline">
                                        {isSendingReminder ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                                        Send payment reminder
                                    </Button>
                                    {paymentLinkCreatedAt && (
                                        <span className="text-xs text-muted-foreground">
                                            Created {format(new Date(paymentLinkCreatedAt), 'dd MMM HH:mm')}
                                        </span>
                                    )}
                                    {order.paymentReminderCount ? (
                                        <span className="text-xs text-muted-foreground">
                                            · {order.paymentReminderCount} reminder{order.paymentReminderCount === 1 ? '' : 's'} sent
                                        </span>
                                    ) : null}
                                </div>
                            </CardContent>
                        </Card>
                    )}

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
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-[40px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {order.items.map(item => {
                                        const effectiveStatus = getEffectiveItemStatus(item.recordId);
                                        const excluded = isItemExcluded(effectiveStatus);
                                        return (
                                        <TableRow key={item.recordId} className={excluded ? 'opacity-60' : ''}>
                                            <TableCell>
                                                <Image src={item.cover_url || 'https://placehold.co/64x64.png'} alt={item.title} width={64} height={64} className="rounded-md aspect-square object-cover" data-ai-hint="album cover"/>
                                            </TableCell>
                                            <TableCell>
                                                <p className={`font-medium ${excluded ? 'line-through' : ''}`}>{item.title}</p>
                                                <p className="text-sm text-muted-foreground">{item.artist}</p>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={itemQuantityChanges[item.recordId] ?? item.quantity}
                                                    onChange={(e) => handleItemQuantityChange(item.recordId, parseInt(e.target.value) || 1)}
                                                    className="w-16 h-8 text-center text-xs mx-auto"
                                                />
                                            </TableCell>
                                            <TableCell className={`text-right ${excluded ? 'line-through' : ''}`}>€ {formatPriceForDisplay(item.priceAtTimeOfOrder)}</TableCell>
                                            <TableCell className={`text-right ${excluded ? 'line-through' : ''}`}>€ {formatPriceForDisplay(item.priceAtTimeOfOrder * (itemQuantityChanges[item.recordId] ?? item.quantity))}</TableCell>
                                            <TableCell>
                                                <Select value={effectiveStatus} onValueChange={(val) => handleItemStatusChange(item.recordId, val as OrderItemStatus)}>
                                                    <SelectTrigger className="w-[140px] h-8 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(Object.entries(itemStatusConfig) as [OrderItemStatus, { label: string; color: string }][]).map(([value, config]) => (
                                                            <SelectItem key={value} value={value}>
                                                                <span className={`inline-flex items-center gap-1.5`}>
                                                                    <span className={`inline-block w-2 h-2 rounded-full ${config.color.split(' ')[0].replace('/20', '')}`}></span>
                                                                    {config.label}
                                                                </span>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Link href={`/records/${item.recordId}`} title="View record">
                                                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            {/* Save / Notify buttons */}
                            {(hasUnsavedItemChanges || hasItemStatusChanges) && (
                                <div className="flex flex-wrap items-center gap-3 mt-4 p-3 bg-muted/50 rounded-lg">
                                    {hasUnsavedItemChanges && (
                                        <Button onClick={handleSaveItemStatuses} disabled={isSavingItemStatuses} size="sm">
                                            {isSavingItemStatuses ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            Save Changes
                                        </Button>
                                    )}
                                    {!hasUnsavedItemChanges && hasItemStatusChanges && (
                                        <Button onClick={handleNotifyClient} disabled={isSendingNotification || isPricingDirty} variant="outline" size="sm" title={isPricingDirty ? 'Recalculate Price + Tax before notifying the client' : undefined}>
                                            {isSendingNotification ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                                            {itemChangesNotifiedAt ? 'Resend Change Notification' : 'Notify Client of Changes'}
                                        </Button>
                                    )}
                                    {hasUnsavedItemChanges && <span className="text-xs text-muted-foreground">You have unsaved item status changes</span>}
                                    {!hasUnsavedItemChanges && itemChangesNotifiedAt && (
                                        <span className={`text-xs ${needsItemChangesNotification ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                                            {needsItemChangesNotification
                                                ? `Items changed since last notification on ${format(new Date(itemChangesNotifiedAt), 'dd MMM HH:mm')} — consider resending`
                                                : `Client notified on ${format(new Date(itemChangesNotifiedAt), 'dd MMM yyyy HH:mm')}`}
                                        </span>
                                    )}
                                </div>
                            )}
                            {invoiceEmailedAt && (
                                <p className="text-xs text-muted-foreground mt-2">
                                    Invoice emailed to customer on {format(new Date(invoiceEmailedAt), 'dd MMM yyyy HH:mm')}
                                    {order.invoiceEmailedCount && order.invoiceEmailedCount > 1 ? ` (${order.invoiceEmailedCount}×)` : ''}
                                </p>
                            )}

                            <Separator className="my-4" />
                            <div className="space-y-1 text-right">
                                {order.originalTotalAmount && order.originalTotalAmount !== order.totalAmount && (
                                    <p className="text-sm text-muted-foreground">Original total: <span className="line-through">€ {formatPriceForDisplay(order.originalTotalAmount)}</span></p>
                                )}
                                {order.subtotalAmount !== undefined && (
                                    <p className="text-sm text-muted-foreground">Subtotal excl. {order.taxLabel || 'VAT'}: € {formatPriceForDisplay(order.subtotalAmount)}</p>
                                )}
                                {/* Discount + shipping are edited in the Pricing card (side panel). */}
                                {order.discountAmount !== undefined && order.discountAmount > 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        Discount {order.discountType === 'percent' ? `(${order.discountValue}%)` : '(Fixed)'}: <span className="text-green-600">− € {formatPriceForDisplay(order.discountAmount)}</span>
                                    </p>
                                )}
                                {order.shippingCost !== undefined && order.shippingCost > 0 && (
                                    <p className="text-sm text-muted-foreground">Shipping{order.shippingZoneName ? ` (${order.shippingZoneName})` : ''}: € {formatPriceForDisplay(order.shippingCost)}</p>
                                )}
                                {order.freeShippingApplied && (
                                    <p className="text-sm text-green-600">Free shipping applied</p>
                                )}
                                {order.shippingMethod === 'pickup' && (
                                    <p className="text-sm text-muted-foreground">Pickup (no shipping)</p>
                                )}
                                {order.taxAmount !== undefined && (
                                    <p className="text-sm text-muted-foreground">
                                        {order.taxLabel || 'VAT'} {order.isReverseCharge ? '0% (Reverse charge)' : `${order.taxRate || 0}%`}: € {formatPriceForDisplay(order.taxAmount)}
                                    </p>
                                )}
                                <p className="font-semibold text-lg">Total: € {formatPriceForDisplay(order.totalAmount)}</p>
                                {order.isReverseCharge && <p className="text-xs text-muted-foreground italic">Reverse charge — VAT to be accounted for by the recipient.</p>}
                                <p className="text-sm text-muted-foreground">Total Items: {order.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
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

                    {/* Pricing card — discount + shipping toggles + unified recalc.
                        Only editable while the order is still open (not paid / shipped / cancelled). */}
                    {canManageOrder && order.status !== 'shipped' && order.status !== 'cancelled' && order.paymentStatus !== 'paid' && (
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-3 text-base">
                                    <DollarSign className="h-5 w-5 text-primary" />
                                    Pricing
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Apply a discount or shipping charge, then recalculate so the invoice reflects the new totals.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* DISCOUNT */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm">Discount</Label>
                                        <Switch
                                            checked={showDiscount}
                                            onCheckedChange={(v: boolean) => {
                                                setShowDiscount(v);
                                                if (!v) setDiscountInput('');
                                            }}
                                        />
                                    </div>
                                    {showDiscount && (
                                        <div className="space-y-2 pl-1">
                                            <div className="flex items-center gap-1 rounded-md border p-0.5 w-fit bg-muted/30">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={discountType === 'fixed' ? 'default' : 'ghost'}
                                                    className="h-7 text-xs"
                                                    onClick={() => setDiscountType('fixed')}
                                                >Fixed amount</Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={discountType === 'percent' ? 'default' : 'ghost'}
                                                    className="h-7 text-xs"
                                                    onClick={() => setDiscountType('percent')}
                                                >Percent</Button>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {discountType === 'fixed' && <span className="text-sm text-muted-foreground">€</span>}
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={discountInput}
                                                    onChange={(e) => setDiscountInput(e.target.value)}
                                                    placeholder={discountType === 'fixed' ? '0.00' : '0'}
                                                    className="h-8 text-sm"
                                                />
                                                {discountType === 'percent' && <span className="text-sm text-muted-foreground">%</span>}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                {discountType === 'percent' ? 'Capped at 100%.' : 'Capped at the items subtotal.'} Applied before VAT.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                {/* SHIPPING */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm">Shipping charge</Label>
                                        <Switch
                                            checked={showShipping}
                                            onCheckedChange={(v: boolean) => {
                                                setShowShipping(v);
                                                if (!v) setShippingCostInput('');
                                            }}
                                        />
                                    </div>
                                    {showShipping && (
                                        <div className="space-y-2 pl-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">€</span>
                                                <Input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={shippingCostInput}
                                                    onChange={(e) => setShippingCostInput(e.target.value)}
                                                    placeholder="0.00"
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            {order.shippingZoneName && (
                                                <p className="text-[11px] text-muted-foreground">Zone: {order.shippingZoneName}</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <Separator />

                                {/* DIRTY WARNING + RECALC BUTTON */}
                                {isPricingDirty && (
                                    <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-2 text-[11px] text-amber-800 dark:text-amber-300">
                                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                                        <span>Pricing has changed — click Recalculate before sending the invoice.</span>
                                    </div>
                                )}
                                <Button
                                    onClick={handleRecalculatePriceAndTax}
                                    disabled={isRecalculating || !isPricingDirty}
                                    size="sm"
                                    className="w-full"
                                    variant={isPricingDirty ? 'default' : 'outline'}
                                >
                                    {isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                    Recalculate Price + Tax
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                     <Card>
                         <CardHeader className="pb-3">
                            <CardTitle className="flex items-center justify-between">
                                <span className="flex items-center gap-3"><User className="h-6 w-6 text-primary" />Customer</span>
                                <Link href={`/clients/${order.viewerId}`}>
                                    <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 text-xs">View Profile</Badge>
                                </Link>
                            </CardTitle>
                         </CardHeader>
                         <CardContent className="space-y-3 text-sm">
                            {/* Name & Company */}
                            {order.customerCompanyName && (
                                <div className="flex items-start gap-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium">{order.customerCompanyName}</p>
                                        <p className="text-muted-foreground">{order.customerName}</p>
                                    </div>
                                </div>
                            )}
                            {!order.customerCompanyName && (
                                <div className="flex items-start gap-2">
                                    <User className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <p className="font-medium">{order.customerName}</p>
                                </div>
                            )}

                            {/* Contact */}
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                                <p className="text-muted-foreground">{order.viewerEmail}</p>
                            </div>
                            {order.phoneNumber && (
                                <div className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <p className="text-muted-foreground">{order.phoneNumber}</p>
                                </div>
                            )}

                            {/* Business details */}
                            {(order.customerVatNumber || order.customerChamberOfCommerce || order.customerEoriNumber) && (
                                <>
                                    <Separator />
                                    <div className="space-y-1 text-xs text-muted-foreground">
                                        {order.customerChamberOfCommerce && <p>CRN: {order.customerChamberOfCommerce}</p>}
                                        {order.customerVatNumber && <p>VAT: {order.customerVatNumber}</p>}
                                        {order.customerEoriNumber && <p>EORI: {order.customerEoriNumber}</p>}
                                    </div>
                                </>
                            )}

                            {/* Addresses */}
                            <Separator />
                            <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-medium text-xs text-muted-foreground mb-1">Shipping Address</p>
                                    <p className="text-muted-foreground whitespace-pre-wrap">{order.shippingAddress}</p>
                                </div>
                            </div>
                            {order.billingAddress && order.billingAddress !== order.shippingAddress && (
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-medium text-xs text-muted-foreground mb-1">Billing Address</p>
                                        <p className="text-muted-foreground whitespace-pre-wrap">{order.billingAddress}</p>
                                    </div>
                                </div>
                            )}

                            {/* Customer Stats */}
                            {customerStats && (
                                <>
                                    <Separator />
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="p-2 rounded-lg bg-muted/50">
                                            <p className="text-lg font-bold text-foreground">{customerStats.totalOrders}</p>
                                            <p className="text-[10px] text-muted-foreground">Orders</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-muted/50">
                                            <p className="text-lg font-bold text-foreground">€{formatPriceForDisplay(customerStats.totalSpent)}</p>
                                            <p className="text-[10px] text-muted-foreground">Spent</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-muted/50">
                                            <p className={`text-lg font-bold ${customerStats.openPayments > 0 ? 'text-amber-500' : 'text-green-500'}`}>{customerStats.openPayments}</p>
                                            <p className="text-[10px] text-muted-foreground">Open</p>
                                        </div>
                                    </div>
                                </>
                            )}
                         </CardContent>
                    </Card>

                    {/* Payment Details Card */}
                    {order.paymentStatus === 'paid' && (() => {
                        // Platform fee only applies when payment was processed through the
                        // built-in Stripe or PayPal Connect flows. Manual methods
                        // (bank_transfer, cash, *_external, other) bypass the platform entirely.
                        const feeBearingMethods = ['stripe', 'paypal'];
                        const isOffPlatform =
                            !!order.paymentMethod && !feeBearingMethods.includes(order.paymentMethod);
                        const hasPlatformFee =
                            !!order.platformFeeAmount &&
                            (!order.paymentMethod || feeBearingMethods.includes(order.paymentMethod));
                        const platformFee = hasPlatformFee ? (order.platformFeeAmount as number) / 100 : 0;
                        const payout = order.totalAmount - platformFee;
                        return (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <DollarSign className="h-6 w-6 text-green-500" />
                                    Payment Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                {isOffPlatform && (
                                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2 text-xs">
                                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="font-medium text-amber-700">Payment handled outside Vinylogix</p>
                                            <p className="text-muted-foreground">
                                                This order was marked as paid manually. The funds were not processed or held by Vinylogix, and the platform has no visibility or control over the transfer. Collection, reconciliation, and any disputes are handled entirely between you and the buyer.
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Order Total:</span>
                                    <span className="font-medium">€{formatPriceForDisplay(order.totalAmount)}</span>
                                </div>
                                {order.shippingCost !== undefined && order.shippingCost > 0 && (
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>(incl. shipping: €{formatPriceForDisplay(order.shippingCost)})</span>
                                    </div>
                                )}
                                {hasPlatformFee && (
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Platform Fee ({order.appliedFeePercentage || 4}%):</span>
                                        <span className="text-red-600">-€{formatPriceForDisplay(platformFee)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between">
                                    <span className="font-semibold">
                                        {isOffPlatform ? 'Amount Due to You' : 'Your Payout'}:
                                    </span>
                                    <span className="font-semibold text-green-600">
                                        €{formatPriceForDisplay(payout)}
                                    </span>
                                </div>
                                {isOffPlatform && (
                                    <p className="text-xs text-muted-foreground -mt-1">
                                        Collected directly by you via {PAYMENT_METHOD_LABELS[order.paymentMethod!] || order.paymentMethod}. Vinylogix does not track or forward these funds.
                                    </p>
                                )}
                                {(order.refunds && order.refunds.length > 0) && (() => {
                                    const totalRefunded = order.refunds!.reduce((s, r) => s + r.amount, 0);
                                    const remaining = order.totalAmount - totalRefunded;
                                    const netReceived = payout - totalRefunded;
                                    return (
                                        <>
                                            <Separator />
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm font-medium">
                                                    <span>Refunds</span>
                                                    <span className="text-red-600">-€{formatPriceForDisplay(totalRefunded)}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {order.refunds!.map((r) => (
                                                        <div key={r.id} className="flex justify-between text-xs text-muted-foreground pl-3 border-l-2 border-red-500/30">
                                                            <div>
                                                                <div>{format(new Date(r.refundedAt), 'PP')} · {PAYMENT_METHOD_LABELS[r.method || ''] || r.method || 'refund'}</div>
                                                                {r.reason && <div className="italic">"{r.reason}"</div>}
                                                            </div>
                                                            <div className="text-red-600 font-medium">-€{formatPriceForDisplay(r.amount)}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="flex justify-between text-sm border-t pt-2">
                                                    <span className="text-muted-foreground">Net received:</span>
                                                    <span className="font-semibold text-green-700">€{formatPriceForDisplay(netReceived)}</span>
                                                </div>
                                                {remaining > 0.01 && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Remaining refundable: €{formatPriceForDisplay(remaining)}
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}
                                {order.paymentMethod && (
                                    <>
                                        <Separator />
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Method:</span>
                                            <span className="font-medium">
                                                {PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}
                                            </span>
                                        </div>
                                        {order.paymentReference && (
                                            <div className="flex justify-between gap-3">
                                                <span className="text-muted-foreground shrink-0">Reference:</span>
                                                <span className="font-medium text-right break-all">{order.paymentReference}</span>
                                            </div>
                                        )}
                                        {order.paymentNotes && (
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground">Notes:</p>
                                                <p className="whitespace-pre-wrap bg-muted rounded px-2 py-1.5 text-xs">
                                                    {order.paymentNotes}
                                                </p>
                                            </div>
                                        )}
                                    </>
                                )}
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
                        );
                    })()}
                </div>
            </div>
        </div>
    )
}

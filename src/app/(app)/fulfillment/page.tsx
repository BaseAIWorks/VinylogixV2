
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import type { Order, OrderStatus } from "@/types";
import { getOrders } from "@/services/order-service";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { format } from "date-fns";

const statusColors: Record<OrderStatus, string> = {
    pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    awaiting_payment: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    paid: 'bg-green-500/20 text-green-500 border-green-500/30',
    processing: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    shipped: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
    on_hold: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    cancelled: 'bg-red-500/20 text-red-500 border-red-500/30',
};

export default function FulfillmentPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchFulfillmentOrders = useCallback(async () => {
        if (!authLoading && user && (user.role === 'master' || (user.role === 'worker' && user.permissions?.canManageOrders))) {
            setIsLoading(true);
            try {
                const fetchedOrders = await getOrders(user);
                setOrders(fetchedOrders.filter(o => o.status === 'paid' || o.status === 'processing'));
            } catch (error) {
                console.error("Failed to fetch orders for fulfillment:", error);
            } finally {
                setIsLoading(false);
            }
        } else if (!authLoading) {
             setIsLoading(false);
        }
    }, [user, authLoading]);

    useEffect(() => {
        fetchFulfillmentOrders();
    }, [fetchFulfillmentOrders]);

    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (user && user.role !== 'master' && !(user.role === 'worker' && user.permissions?.canManageOrders)) {
        return (
            <div className="flex flex-col items-center justify-center text-center p-6">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
                <p className="text-muted-foreground mt-2">You do not have permission to manage order fulfillment.</p>
                <Button onClick={() => router.push('/dashboard')} className="mt-6">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
             <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Truck className="h-6 w-6 text-primary" />
                        <span>Order Fulfillment</span>
                    </CardTitle>
                    <CardDescription>
                        Orders that are paid and need to be processed and shipped.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                   {orders.length > 0 ? (
                       <div className="overflow-x-auto">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Order #</TableHead>
                                       <TableHead className="hidden sm:table-cell">Client</TableHead>
                                       <TableHead>Date Paid</TableHead>
                                       <TableHead>Status</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {orders.map(order => (
                                       <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/orders/${order.id}`)}>
                                           <TableCell className="font-mono text-sm">{order.orderNumber || order.id.slice(0, 8)}</TableCell>
                                           <TableCell className="hidden sm:table-cell">{order.viewerEmail}</TableCell>
                                           <TableCell>{format(new Date(order.updatedAt), 'dd MMM yyyy')}</TableCell>
                                           <TableCell>
                                               <Badge variant="outline" className={`capitalize ${statusColors[order.status]}`}>
                                                   {order.status.replace('_', ' ')}
                                               </Badge>
                                           </TableCell>
                                       </TableRow>
                                   ))}
                               </TableBody>
                           </Table>
                       </div>
                   ) : (
                       <div className="text-center py-12 text-muted-foreground">
                            <p className="text-lg">All caught up!</p>
                            <p className="text-sm">There are no orders waiting for fulfillment.</p>
                       </div>
                   )}
                </CardContent>
            </Card>
        </div>
    );
}

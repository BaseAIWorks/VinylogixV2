
"use client";
import ProtectedRoute from "@/components/layout/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { getOrdersByViewerId } from "@/services/order-service";
import type { Order, OrderStatus } from "@/types";
import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { formatPriceForDisplay } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const statusColors: Record<OrderStatus, string> = {
    pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    awaiting_payment: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    paid: 'bg-green-500/20 text-green-500 border-green-500/30',
    processing: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    shipped: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
    on_hold: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    cancelled: 'bg-red-500/20 text-red-500 border-red-500/30',
};

export default function MyOrdersPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && user && user.role === 'viewer') {
            const fetchOrders = async () => {
                setIsLoading(true);
                try {
                    const fetchedOrders = await getOrdersByViewerId(user.uid);
                    setOrders(fetchedOrders);
                } catch (error) {
                    console.error("Failed to fetch client orders:", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchOrders();
        } else if (!authLoading && user && user.role !== 'viewer') {
            router.replace('/dashboard');
        } else if (!authLoading && !user) {
            setIsLoading(false);
        }
    }, [user, authLoading, router]);

    if (authLoading || isLoading) {
        return (
            <ProtectedRoute>
                <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </div>
            </ProtectedRoute>
        );
    }
    
    if(user && user.role !== 'viewer') {
        return (
            <ProtectedRoute>
                <div className="flex flex-col items-center justify-center text-center p-6">
                    <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                    <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
                    <p className="text-muted-foreground mt-2">This page is for clients only.</p>
                    <Button onClick={() => router.push('/dashboard')} className="mt-6">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
                    </Button>
                </div>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <div className="space-y-6">
                 <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <ShoppingCart className="h-6 w-6 text-primary" />
                            <span>My Order History</span>
                        </CardTitle>
                        <CardDescription>
                           Here you can find all the orders you have placed.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       {orders.length > 0 ? (
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Order #</TableHead>
                                       <TableHead>Date</TableHead>
                                       <TableHead>Status</TableHead>
                                       <TableHead className="text-right">Total</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {orders.map(order => (
                                       <TableRow key={order.id} className="hover:bg-muted/50">
                                           <TableCell className="font-mono text-sm">{order.orderNumber || order.id.slice(0, 8)}</TableCell>
                                           <TableCell>{format(new Date(order.createdAt), 'dd MMM yyyy')}</TableCell>
                                           <TableCell>
                                               <Badge variant="outline" className={`capitalize ${statusColors[order.status]}`}>
                                                   {order.status.replace('_', ' ')}
                                               </Badge>
                                           </TableCell>
                                           <TableCell className="text-right font-medium">€ {formatPriceForDisplay(order.totalAmount)}</TableCell>
                                       </TableRow>
                                   ))}
                               </TableBody>
                           </Table>
                       ) : (
                           <div className="text-center py-12 text-muted-foreground">
                                <p className="text-lg">You haven't placed any orders yet.</p>
                           </div>
                       )}
                    </CardContent>
                </Card>
            </div>
        </ProtectedRoute>
    );
}

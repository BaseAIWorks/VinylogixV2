"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Truck, Loader2, AlertTriangle, ArrowLeft, LayoutGrid, List, Package, CreditCard, Printer, Clock } from "lucide-react";
import type { Order, OrderStatus } from "@/types";
import { getOrders, updateOrderStatus } from "@/services/order-service";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { format, parseISO, differenceInDays } from "date-fns";
import { formatPriceForDisplay, checkBusinessProfileComplete } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KanbanBoard } from "@/components/fulfillment/kanban-board";
import { BulkActionsBar, type BulkAction } from "@/components/ui/bulk-actions-bar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const { user, loading: authLoading, activeDistributor } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const fetchFulfillmentOrders = useCallback(async () => {
    if (!authLoading && user && (user.role === 'master' || (user.role === 'worker' && user.permissions?.canManageOrders))) {
      setIsLoading(true);
      try {
        const fetchedOrders = await getOrders(user);
        // Only show orders in fulfillment workflow: paid, processing, shipped (last 7 days)
        const fulfillmentOrders = fetchedOrders.filter(o => {
          if (o.status === 'paid' || o.status === 'processing') return true;
          if (o.status === 'shipped') {
            const shippedDaysAgo = differenceInDays(new Date(), parseISO(o.updatedAt));
            return shippedDaysAgo <= 7;
          }
          return false;
        });
        setOrders(fulfillmentOrders);
      } catch (error) {
        console.error("Failed to fetch orders for fulfillment:", error);
        toast({ title: "Error", description: "Failed to fetch orders.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [user, authLoading, toast]);

  useEffect(() => {
    fetchFulfillmentOrders();
  }, [fetchFulfillmentOrders]);

  // Quick stats
  const stats = useMemo(() => {
    const paidCount = orders.filter(o => o.status === 'paid').length;
    const processingCount = orders.filter(o => o.status === 'processing').length;
    const shippedCount = orders.filter(o => o.status === 'shipped').length;
    const urgentCount = orders.filter(o => {
      const age = differenceInDays(new Date(), parseISO(o.createdAt));
      return (o.status === 'paid' || o.status === 'processing') && age > 3;
    }).length;
    return { paidCount, processingCount, shippedCount, urgentCount };
  }, [orders]);

  const businessProfileStatus = checkBusinessProfileComplete(activeDistributor);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    if (!user) return;

    // Block processing/shipped if business profile is incomplete
    if ((newStatus === 'processing' || newStatus === 'shipped') && !businessProfileStatus.isComplete) {
      toast({
        title: "Business Profile Incomplete",
        description: `Please complete your business profile before processing orders. Missing: ${businessProfileStatus.missingFields.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    try {
      await updateOrderStatus(orderId, newStatus, user);
      toast({
        title: "Status Updated",
        description: `Order marked as ${newStatus.replace('_', ' ')}.`,
      });
      fetchFulfillmentOrders();
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    }
  };

  const handleViewOrder = (orderId: string) => {
    router.push(`/orders/${orderId}`);
  };

  // Selection handlers
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleSelectAllInColumn = (status: OrderStatus) => {
    const columnOrders = orders.filter(o => o.status === status);
    const allSelected = columnOrders.every(o => selectedOrders.has(o.id));

    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (allSelected) {
        columnOrders.forEach(o => next.delete(o.id));
      } else {
        columnOrders.forEach(o => next.add(o.id));
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  // Bulk actions
  const handleBulkStatusUpdate = async (newStatus: OrderStatus) => {
    if (!user || selectedOrders.size === 0) return;

    // Block processing/shipped if business profile is incomplete
    if ((newStatus === 'processing' || newStatus === 'shipped') && !businessProfileStatus.isComplete) {
      toast({
        title: "Business Profile Incomplete",
        description: `Please complete your business profile before processing orders. Missing: ${businessProfileStatus.missingFields.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessingBulk(true);
    try {
      const updates = Array.from(selectedOrders).map(orderId =>
        updateOrderStatus(orderId, newStatus, user)
      );
      await Promise.all(updates);
      toast({
        title: "Bulk Update Complete",
        description: `${selectedOrders.size} order(s) marked as ${newStatus.replace('_', ' ')}.`,
      });
      setSelectedOrders(new Set());
      fetchFulfillmentOrders();
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Bulk actions configuration
  const bulkActions: BulkAction[] = [
    {
      id: "mark-processing",
      label: "Mark Processing",
      icon: Package,
      onClick: () => handleBulkStatusUpdate("processing"),
    },
    {
      id: "mark-shipped",
      label: "Mark Shipped",
      icon: Truck,
      onClick: () => handleBulkStatusUpdate("shipped"),
    },
  ];

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
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.paidCount}</p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.processingCount}</p>
                <p className="text-xs text-muted-foreground">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/20">
                <Truck className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.shippedCount}</p>
                <p className="text-xs text-muted-foreground">Shipped (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={stats.urgentCount > 0 ? "border-red-300 dark:border-red-800" : ""}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.urgentCount > 0 ? 'bg-red-100 dark:bg-red-900/20' : 'bg-gray-100 dark:bg-gray-900/20'}`}>
                <Clock className={`h-5 w-5 ${stats.urgentCount > 0 ? 'text-red-600' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.urgentCount}</p>
                <p className="text-xs text-muted-foreground">Urgent (&gt;3 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Truck className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Order Fulfillment</CardTitle>
                <CardDescription>
                  Orders that are paid and need to be processed and shipped.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "kanban" | "table")}>
                <TabsList className="grid grid-cols-2 w-[160px]">
                  <TabsTrigger value="kanban" className="text-xs">
                    <LayoutGrid className="h-4 w-4 mr-1" />
                    Kanban
                  </TabsTrigger>
                  <TabsTrigger value="table" className="text-xs">
                    <List className="h-4 w-4 mr-1" />
                    Table
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {orders.length > 0 ? (
            viewMode === "kanban" ? (
              <KanbanBoard
                orders={orders}
                onStatusChange={handleStatusChange}
                onViewOrder={handleViewOrder}
                selectedOrders={selectedOrders}
                onSelectOrder={toggleOrderSelection}
                onSelectAll={handleSelectAllInColumn}
                showCheckboxes
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedOrders.size === orders.length && orders.length > 0}
                          onCheckedChange={() => {
                            if (selectedOrders.size === orders.length) {
                              setSelectedOrders(new Set());
                            } else {
                              setSelectedOrders(new Set(orders.map(o => o.id)));
                            }
                          }}
                          aria-label="Select all"
                        />
                      </TableHead>
                      <TableHead>Order #</TableHead>
                      <TableHead className="hidden sm:table-cell">Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell text-center">Items</TableHead>
                      <TableHead className="hidden md:table-cell">Age</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map(order => {
                      const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
                      const orderAge = differenceInDays(new Date(), parseISO(order.createdAt));

                      return (
                        <TableRow
                          key={order.id}
                          className={`cursor-pointer hover:bg-muted/50 ${selectedOrders.has(order.id) ? 'bg-muted/30' : ''}`}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedOrders.has(order.id)}
                              onCheckedChange={() => toggleOrderSelection(order.id)}
                              aria-label={`Select order ${order.orderNumber || order.id}`}
                            />
                          </TableCell>
                          <TableCell
                            className="font-mono text-sm"
                            onClick={() => handleViewOrder(order.id)}
                          >
                            {order.orderNumber || order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell
                            className="hidden sm:table-cell"
                            onClick={() => handleViewOrder(order.id)}
                          >
                            {order.customerName}
                          </TableCell>
                          <TableCell onClick={() => handleViewOrder(order.id)}>
                            <Badge variant="outline" className={`capitalize ${statusColors[order.status]}`}>
                              {order.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-center" onClick={() => handleViewOrder(order.id)}>
                            {totalItems}
                          </TableCell>
                          <TableCell className="hidden md:table-cell" onClick={() => handleViewOrder(order.id)}>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Badge
                                    variant="outline"
                                    className={
                                      orderAge > 3
                                        ? "bg-red-100 text-red-700 border-red-200"
                                        : orderAge > 1
                                        ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                                        : ""
                                    }
                                  >
                                    {orderAge}d
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Order placed {format(parseISO(order.createdAt), 'dd MMM yyyy')}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="text-right font-medium" onClick={() => handleViewOrder(order.id)}>
                            € {formatPriceForDisplay(order.totalAmount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <EmptyState
              icon={Truck}
              title="All caught up!"
              description="There are no orders waiting for fulfillment."
            />
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedOrders.size}
        actions={bulkActions}
        onClearSelection={clearSelection}
        isProcessing={isProcessingBulk}
        processingLabel="Updating orders..."
      />
    </div>
  );
}

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShoppingCart, Loader2, AlertTriangle, ArrowLeft, Eye, CreditCard, Truck, Package, MoreVertical } from "lucide-react";
import type { Order, OrderStatus } from "@/types";
import { getOrders, updateOrderStatus } from "@/services/order-service";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO, isWithinInterval } from "date-fns";
import { formatPriceForDisplay } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { StatusTabs, type StatusTab } from "@/components/ui/status-tabs";
import { DataTableToolbar, type DateRange, type DateRangePreset, getDateRangeFromPreset } from "@/components/ui/data-table-toolbar";
import { BulkActionsBar, type BulkAction } from "@/components/ui/bulk-actions-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { QuickActionButton } from "@/components/ui/quick-action-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pending',
  awaiting_payment: 'Awaiting Payment',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  on_hold: 'On Hold',
  cancelled: 'Cancelled',
};

export default function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">(
    (searchParams.get('status') as OrderStatus) || "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("all");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  const fetchOrders = useCallback(async () => {
    if (!authLoading && user && (user.role === 'master' || (user.role === 'worker' && user.permissions?.canManageOrders))) {
      setIsLoading(true);
      try {
        const fetchedOrders = await getOrders(user);
        setOrders(fetchedOrders);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
        toast({ title: "Error", description: "Failed to fetch orders.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    } else if (!authLoading && user) {
      router.replace('/dashboard');
    } else if (!authLoading && !user) {
      setIsLoading(false);
    }
  }, [user, authLoading, router, toast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Update URL when status changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (statusFilter === "all") {
      params.delete('status');
    } else {
      params.set('status', statusFilter);
    }
    const newUrl = params.toString() ? `?${params.toString()}` : '/orders';
    window.history.replaceState(null, '', newUrl);
  }, [statusFilter, searchParams]);

  // Status counts for tabs
  const statusCounts = useMemo(() => {
    const counts: Record<OrderStatus | "all", number> = {
      all: orders.length,
      pending: 0,
      awaiting_payment: 0,
      paid: 0,
      processing: 0,
      shipped: 0,
      on_hold: 0,
      cancelled: 0,
    };
    orders.forEach(order => {
      counts[order.status]++;
    });
    return counts;
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(order => order.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(order =>
        (order.orderNumber?.toLowerCase() || '').includes(query) ||
        order.viewerEmail.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query)
      );
    }

    // Date filter
    if (dateRange.from || dateRange.to) {
      result = result.filter(order => {
        const orderDate = parseISO(order.createdAt);
        if (dateRange.from && dateRange.to) {
          return isWithinInterval(orderDate, { start: dateRange.from, end: dateRange.to });
        }
        if (dateRange.from) {
          return orderDate >= dateRange.from;
        }
        return true;
      });
    }

    return result;
  }, [orders, statusFilter, searchQuery, dateRange]);

  // Status tabs
  const statusTabs: StatusTab<OrderStatus>[] = [
    { value: "all", label: "All", count: statusCounts.all },
    { value: "pending", label: "Pending", count: statusCounts.pending },
    { value: "awaiting_payment", label: "Awaiting Payment", count: statusCounts.awaiting_payment },
    { value: "paid", label: "Paid", count: statusCounts.paid },
    { value: "processing", label: "Processing", count: statusCounts.processing },
    { value: "shipped", label: "Shipped", count: statusCounts.shipped },
    { value: "cancelled", label: "Cancelled", count: statusCounts.cancelled },
  ];

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

  const toggleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  // Quick actions
  const handleQuickStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    if (!user) return;
    try {
      await updateOrderStatus(orderId, newStatus, user);
      toast({ title: "Status Updated", description: `Order marked as ${statusLabels[newStatus]}.` });
      fetchOrders();
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    }
  };

  // Bulk actions
  const handleBulkStatusUpdate = async (newStatus: OrderStatus) => {
    if (!user || selectedOrders.size === 0) return;
    setIsProcessingBulk(true);
    try {
      const updates = Array.from(selectedOrders).map(orderId =>
        updateOrderStatus(orderId, newStatus, user)
      );
      await Promise.all(updates);
      toast({
        title: "Bulk Update Complete",
        description: `${selectedOrders.size} order(s) marked as ${statusLabels[newStatus]}.`,
      });
      setSelectedOrders(new Set());
      fetchOrders();
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsProcessingBulk(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ["Order #", "Customer", "Email", "Date", "Status", "Items", "Total"];
    const rows = filteredOrders.map(order => [
      order.orderNumber || order.id.slice(0, 8),
      order.customerName,
      order.viewerEmail,
      format(parseISO(order.createdAt), 'yyyy-MM-dd'),
      statusLabels[order.status],
      order.items.reduce((sum, item) => sum + item.quantity, 0).toString(),
      formatPriceForDisplay(order.totalAmount),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `orders_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast({ title: "Export Complete", description: `${filteredOrders.length} orders exported to CSV.` });
  };

  // Bulk actions configuration
  const bulkActions: BulkAction[] = [
    {
      id: "mark-paid",
      label: "Mark as Paid",
      icon: CreditCard,
      onClick: () => handleBulkStatusUpdate("paid"),
    },
    {
      id: "mark-processing",
      label: "Mark as Processing",
      icon: Package,
      onClick: () => handleBulkStatusUpdate("processing"),
    },
    {
      id: "mark-shipped",
      label: "Mark as Shipped",
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

  if (user && user.role === 'viewer') {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">This page is for managing incoming orders. View your own orders in "My Orders".</p>
        <Button onClick={() => router.push('/my-orders')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to My Orders
        </Button>
      </div>
    );
  }

  if (user && user.role === 'worker' && !user.permissions?.canManageOrders) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Permission Denied</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to manage orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <ShoppingCart className="h-6 w-6 text-primary" />
            <span>Incoming Orders</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Tabs */}
          <StatusTabs
            tabs={statusTabs}
            value={statusFilter}
            onChange={setStatusFilter}
          />

          {/* Toolbar */}
          <DataTableToolbar
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by order #, customer name, or email..."
            showDateFilter
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            datePreset={datePreset}
            onDatePresetChange={setDatePreset}
            showExport
            onExport={handleExportCSV}
            selectedCount={selectedOrders.size}
            onClearSelection={clearSelection}
          />

          {/* Orders Table */}
          {filteredOrders.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Order #</TableHead>
                    <TableHead className="hidden sm:table-cell">Client</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell text-center">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map(order => {
                    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
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
                          onClick={() => router.push(`/orders/${order.id}`)}
                        >
                          {order.orderNumber || order.id.slice(0, 8)}
                        </TableCell>
                        <TableCell
                          className="hidden sm:table-cell"
                          onClick={() => router.push(`/orders/${order.id}`)}
                        >
                          <div>
                            <div className="font-medium">{order.customerName}</div>
                            <div className="text-xs text-muted-foreground">{order.viewerEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => router.push(`/orders/${order.id}`)}>
                          {format(parseISO(order.createdAt), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell onClick={() => router.push(`/orders/${order.id}`)}>
                          <Badge variant="outline" className={`capitalize ${statusColors[order.status]}`}>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-center" onClick={() => router.push(`/orders/${order.id}`)}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="cursor-help">
                                  {totalItems}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <div className="space-y-1">
                                  {order.items.slice(0, 3).map((item, idx) => (
                                    <div key={idx} className="text-xs">
                                      {item.quantity}x {item.title} - {item.artist}
                                    </div>
                                  ))}
                                  {order.items.length > 3 && (
                                    <div className="text-xs text-muted-foreground">
                                      +{order.items.length - 3} more items
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-right font-medium" onClick={() => router.push(`/orders/${order.id}`)}>
                          € {formatPriceForDisplay(order.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <QuickActionButton
                              icon={Eye}
                              label="View Order"
                              onClick={() => router.push(`/orders/${order.id}`)}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {order.status !== 'paid' && order.status !== 'shipped' && order.status !== 'cancelled' && (
                                  <DropdownMenuItem onClick={() => handleQuickStatusUpdate(order.id, 'paid')}>
                                    <CreditCard className="mr-2 h-4 w-4" /> Mark as Paid
                                  </DropdownMenuItem>
                                )}
                                {order.status === 'paid' && (
                                  <DropdownMenuItem onClick={() => handleQuickStatusUpdate(order.id, 'processing')}>
                                    <Package className="mr-2 h-4 w-4" /> Mark as Processing
                                  </DropdownMenuItem>
                                )}
                                {(order.status === 'paid' || order.status === 'processing') && (
                                  <DropdownMenuItem onClick={() => handleQuickStatusUpdate(order.id, 'shipped')}>
                                    <Truck className="mr-2 h-4 w-4" /> Mark as Shipped
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title="No orders found"
              description={
                statusFilter !== "all" || searchQuery
                  ? "Try adjusting your filters or search query."
                  : "Clients haven't placed any orders yet."
              }
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

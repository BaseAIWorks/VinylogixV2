"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Loader2, AlertTriangle, ArrowLeft, TrendingUp, Package, Users, Download, Search, Filter } from "lucide-react";
import type { Order, OrderStatus, Distributor } from "@/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getAllOrders, getPlatformFeeStats } from "@/services/admin-order-service";
import { getDistributors } from "@/services/distributor-service";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { formatPriceForDisplay } from "@/lib/utils";

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  awaiting_payment: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-500 border-green-500/30',
  processing: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
  shipped: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
  on_hold: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
  cancelled: 'bg-red-500/20 text-red-500 border-red-500/30',
};

const StatCard = ({
  title,
  value,
  subtext,
  icon: Icon,
  color
}: {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ElementType;
  color?: string;
}) => (
  <Card className="relative overflow-hidden">
    {color && <div className={`absolute top-0 left-0 h-full w-1 ${color}`} />}
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-5 w-5 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl md:text-3xl font-bold text-primary">{value}</div>
      <p className="text-xs text-muted-foreground">{subtext}</p>
    </CardContent>
  </Card>
);

export default function AdminRevenuePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [stats, setStats] = useState<{
    totalRevenue: number;
    totalPlatformFees: number;
    totalDistributorPayouts: number;
    paidOrderCount: number;
    totalOrderCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [distributorFilter, setDistributorFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    if (!user || user.role !== 'superadmin') {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [ordersData, distributorsData, statsData] = await Promise.all([
        getAllOrders(),
        getDistributors(),
        getPlatformFeeStats(),
      ]);

      setOrders(ordersData);
      setDistributors(distributorsData);
      setStats(statsData);
    } catch (error) {
      const errorMessage = (error as Error).message || "An unknown error occurred.";
      toast({
        title: "Error",
        description: `Could not fetch revenue data. ${errorMessage}`,
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    if (!authLoading && user?.role === 'superadmin') {
      fetchData();
    } else if (!authLoading) {
      setIsLoading(false);
    }
  }, [user, authLoading, fetchData]);

  // Create distributor lookup map
  const distributorMap = useMemo(() => {
    return distributors.reduce((acc, dist) => {
      acc[dist.id] = dist;
      return acc;
    }, {} as Record<string, Distributor>);
  }, [distributors]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Search filter (order number, customer name, email)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          order.orderNumber?.toLowerCase().includes(query) ||
          order.customerName?.toLowerCase().includes(query) ||
          order.viewerEmail?.toLowerCase().includes(query) ||
          order.id.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== "all" && order.status !== statusFilter) {
        return false;
      }

      // Distributor filter
      if (distributorFilter !== "all" && order.distributorId !== distributorFilter) {
        return false;
      }

      return true;
    });
  }, [orders, searchQuery, statusFilter, distributorFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      toast({
        title: "No Data",
        description: "No orders to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Order Number",
      "Date",
      "Customer Name",
      "Customer Email",
      "Distributor",
      "Status",
      "Total Amount",
      "Platform Fee",
      "Distributor Payout",
    ];

    const rows = filteredOrders.map(order => {
      const distributor = distributorMap[order.distributorId];
      const platformFee = order.platformFeeAmount ? (order.platformFeeAmount / 100) : 0;
      const payout = order.totalAmount - platformFee;

      return [
        order.orderNumber || order.id.slice(0, 8),
        format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm'),
        order.customerName || 'N/A',
        order.viewerEmail || 'N/A',
        distributor?.name || 'Unknown',
        order.status,
        order.totalAmount.toFixed(2),
        platformFee.toFixed(2),
        payout.toFixed(2),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-revenue-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Exported ${filteredOrders.length} orders to CSV.`,
    });
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

  return (
    <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Revenue"
            value={`€ ${formatPriceForDisplay(stats?.totalRevenue || 0)}`}
            subtext="All paid orders"
            icon={TrendingUp}
            color="bg-primary"
          />
          <StatCard
            title="Platform Fees"
            value={`€ ${formatPriceForDisplay(stats?.totalPlatformFees || 0)}`}
            subtext="4% commission earned"
            icon={DollarSign}
            color="bg-green-500"
          />
          <StatCard
            title="Distributor Payouts"
            value={`€ ${formatPriceForDisplay(stats?.totalDistributorPayouts || 0)}`}
            subtext="Paid to sellers"
            icon={Users}
            color="bg-blue-500"
          />
          <StatCard
            title="Total Orders"
            value={stats?.paidOrderCount || 0}
            subtext={`${stats?.totalOrderCount || 0} total (incl. unpaid)`}
            icon={Package}
            color="bg-purple-500"
          />
        </div>

        {/* Orders Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <DollarSign className="h-6 w-6 text-primary" />
              <span>Platform Revenue & Orders</span>
            </CardTitle>
            <CardDescription>
              Detailed breakdown of all orders with platform fees and distributor payouts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order #, customer name, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={distributorFilter} onValueChange={setDistributorFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by distributor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Distributors</SelectItem>
                  {distributors.map(dist => (
                    <SelectItem key={dist.id} value={dist.id}>
                      {dist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleExportCSV} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            {/* Results count */}
            <p className="text-sm text-muted-foreground">
              Showing {filteredOrders.length} of {orders.length} orders
            </p>

            {/* Table */}
            {filteredOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Distributor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Platform Fee</TableHead>
                      <TableHead className="text-right">Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(order => {
                      const distributor = distributorMap[order.distributorId];
                      const platformFee = order.platformFeeAmount ? (order.platformFeeAmount / 100) : 0;
                      const payout = order.totalAmount - platformFee;

                      return (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/admin/revenue/${order.id}`)}
                        >
                          <TableCell className="font-mono text-sm">
                            {order.orderNumber || order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(order.createdAt), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{order.customerName || 'N/A'}</span>
                              <span className="text-xs text-muted-foreground">{order.viewerEmail}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-sm text-primary hover:underline cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/admin/distributors/${order.distributorId}`);
                              }}
                            >
                              {distributor?.name || 'Unknown'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`capitalize ${statusColors[order.status]}`}>
                              {order.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            € {formatPriceForDisplay(order.totalAmount)}
                          </TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            € {formatPriceForDisplay(platformFee)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            € {formatPriceForDisplay(payout)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">No orders found matching your filters.</p>
                <p className="text-sm">Try adjusting your search criteria.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}

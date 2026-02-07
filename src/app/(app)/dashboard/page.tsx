"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Package, ShoppingCart, Users, Library, ListChecks, ArrowRight, BarChart3, Building, HardHat, Briefcase, ScanLine, Archive, Tags, Euro, Barcode, Newspaper, AlertTriangle, Keyboard, TrendingUp, TrendingDown, Clock, AlertCircle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { VinylRecord, Order, OrderStatus, Distributor } from "@/types";
import { getAllInventoryRecords, getLatestRecordsFromDistributors } from "@/services/record-service";
import { getOrders } from "@/services/order-service";
import { getDistributorById } from "@/services/distributor-service";
import { useToast } from "@/hooks/use-toast";
import { formatPriceForDisplay, cn } from "@/lib/utils";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import RecordCard from "@/components/records/record-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, subDays, isAfter, parseISO, startOfDay } from 'date-fns';
import { TrendIndicator, calculateTrend } from "@/components/ui/trend-indicator";

type DateRangePreset = "today" | "7days" | "30days" | "all";

const dateRangeOptions: { value: DateRangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7days", label: "7 Days" },
  { value: "30days", label: "30 Days" },
  { value: "all", label: "All Time" },
];

const QuickLinkCard = ({ title, description, href, icon: Icon, badge }: { title: string, description: string, href: string, icon: React.ElementType, badge?: number }) => (
    <Card className="hover:border-primary transition-colors group relative">
      <Link href={href} className="block h-full p-0">
        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
            <div className="bg-primary/10 text-primary p-3 rounded-full group-hover:scale-110 transition-transform">
                <Icon className="h-6 w-6" />
            </div>
            <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  {title}
                  {badge !== undefined && badge > 0 && (
                    <Badge variant="destructive" className="text-xs">{badge}</Badge>
                  )}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </CardHeader>
      </Link>
    </Card>
);

interface StatCardProps {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  highlight?: boolean;
  href?: string;
}

const StatCard = ({ title, value, subtext, icon: Icon, trend, trendLabel, highlight, href }: StatCardProps) => {
  const content = (
    <Card className={cn(
      "transition-colors",
      highlight && "border-orange-300 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20",
      href && "hover:border-primary cursor-pointer"
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", highlight ? "text-orange-500" : "text-muted-foreground")} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-primary">{value}</div>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-muted-foreground">{subtext}</p>
          {trend !== undefined && (
            <TrendIndicator value={trend} size="sm" />
          )}
        </div>
        {trendLabel && trend !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            {trend >= 0 ? "+" : ""}{trend.toFixed(1)}% {trendLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
};

const statusColors: Record<OrderStatus, string> = {
    pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    awaiting_payment: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    paid: 'bg-green-500/20 text-green-500 border-green-500/30',
    processing: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    shipped: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
    on_hold: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    cancelled: 'bg-red-500/20 text-red-500 border-red-500/30',
};


export default function DashboardPage() {
    const { user, loading: authLoading, toggleFavorite, activeDistributorId } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [records, setRecords] = useState<VinylRecord[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [latestRecords, setLatestRecords] = useState<VinylRecord[]>([]);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [dateRange, setDateRange] = useState<DateRangePreset>("30days");
    const [distributor, setDistributor] = useState<Distributor | null>(null);

     const fetchMasterStatsData = useCallback(async () => {
        if (!user || user.role !== 'master' || !user.distributorId) {
            setIsLoadingStats(false);
            return;
        }
        setIsLoadingStats(true);
        try {
            const [fetchedRecords, fetchedOrders, fetchedDistributor] = await Promise.all([
                getAllInventoryRecords(user, user.distributorId),
                getOrders(user),
                getDistributorById(user.distributorId),
            ]);
            setRecords(fetchedRecords);
            setOrders(fetchedOrders);
            setDistributor(fetchedDistributor);
        } catch (error) {
            toast({ title: "Error", description: `Could not load dashboard statistics.`, variant: "destructive" });
        } finally {
            setIsLoadingStats(false);
        }
    }, [user, toast]);

    const fetchViewerDashboardData = useCallback(async () => {
      if (!user || user.role !== 'viewer' || !user.accessibleDistributorIds || user.accessibleDistributorIds.length === 0) {
        setIsLoadingStats(false);
        return;
      }
      setIsLoadingStats(true);
      try {
        const fetchedLatest = await getLatestRecordsFromDistributors(user.accessibleDistributorIds, 10);
        setLatestRecords(fetchedLatest);
      } catch (error) {
        toast({ title: "Error", description: `Could not load latest records.`, variant: "destructive" });
      } finally {
        setIsLoadingStats(false);
      }
    }, [user, toast]);

    useEffect(() => {
        if (!authLoading && user?.role === 'master') {
            fetchMasterStatsData();
        } else if (!authLoading && user?.role === 'viewer') {
            fetchViewerDashboardData();
        } else if (!authLoading) {
            setIsLoadingStats(false);
        }
    }, [user, authLoading, fetchMasterStatsData, fetchViewerDashboardData]);

    // Get date cutoff based on selected range
    const getDateCutoff = useCallback((preset: DateRangePreset): Date | null => {
      const now = new Date();
      switch (preset) {
        case "today": return startOfDay(now);
        case "7days": return subDays(now, 7);
        case "30days": return subDays(now, 30);
        default: return null;
      }
    }, []);

    // Get previous period cutoff for trend calculation
    const getPreviousPeriodCutoff = useCallback((preset: DateRangePreset): { start: Date; end: Date } | null => {
      const now = new Date();
      switch (preset) {
        case "today":
          return { start: startOfDay(subDays(now, 1)), end: startOfDay(now) };
        case "7days":
          return { start: subDays(now, 14), end: subDays(now, 7) };
        case "30days":
          return { start: subDays(now, 60), end: subDays(now, 30) };
        default:
          return null;
      }
    }, []);

    const masterStats = useMemo(() => {
        if (user?.role !== 'master') return null;

        const inventoryRecords = records.filter(r => r.isInventoryItem);
        const totalRecords = inventoryRecords.length;
        const totalItems = inventoryRecords.reduce((sum, r) => {
            const shelves = Number(r.stock_shelves);
            const storage = Number(r.stock_storage);
            const currentStock = (isNaN(shelves) ? 0 : shelves) + (isNaN(storage) ? 0 : storage);
            return sum + currentStock;
        }, 0);
        const totalPurchasingValue = inventoryRecords.reduce((sum, r) => {
            const totalStock = (Number(r.stock_shelves) || 0) + (Number(r.stock_storage) || 0);
            const purchasingPrice = Number(r.purchasingPrice);
            const itemValue = (isNaN(purchasingPrice) ? 0 : purchasingPrice) * totalStock;
            return sum + itemValue;
        }, 0);
        const totalSellingValue = inventoryRecords.reduce((sum, r) => {
            const totalStock = (Number(r.stock_shelves) || 0) + (Number(r.stock_storage) || 0);
            const sellingPrice = Number(r.sellingPrice);
            const itemValue = (isNaN(sellingPrice) ? 0 : sellingPrice) * totalStock;
            return sum + itemValue;
        }, 0);

        // Low stock calculation
        const lowStockThreshold = distributor?.lowStockThreshold || 3;
        const lowStockRecords = inventoryRecords.filter(r => {
          const totalStock = (Number(r.stock_shelves) || 0) + (Number(r.stock_storage) || 0);
          return totalStock > 0 && totalStock <= lowStockThreshold;
        });

        // Filter orders by date range
        const dateCutoff = getDateCutoff(dateRange);
        const filteredOrders = dateCutoff
          ? orders.filter(o => isAfter(parseISO(o.createdAt), dateCutoff))
          : orders;

        // Calculate orders for previous period (for trend)
        const previousPeriod = getPreviousPeriodCutoff(dateRange);
        const previousPeriodOrders = previousPeriod
          ? orders.filter(o => {
              const orderDate = parseISO(o.createdAt);
              return isAfter(orderDate, previousPeriod.start) && !isAfter(orderDate, previousPeriod.end);
            })
          : [];

        // Revenue calculations
        const currentRevenue = filteredOrders
          .filter(o => o.status === 'paid' || o.status === 'shipped' || o.status === 'processing')
          .reduce((sum, o) => sum + o.totalAmount, 0);

        const previousRevenue = previousPeriodOrders
          .filter(o => o.status === 'paid' || o.status === 'shipped' || o.status === 'processing')
          .reduce((sum, o) => sum + o.totalAmount, 0);

        const revenueTrend = calculateTrend(currentRevenue, previousRevenue);

        // Order count trend
        const currentOrderCount = filteredOrders.length;
        const previousOrderCount = previousPeriodOrders.length;
        const orderCountTrend = calculateTrend(currentOrderCount, previousOrderCount);

        const ordersNeedAttention = orders.filter(o => o.status === 'pending' || o.status === 'awaiting_payment').length;
        const recentOrders = orders.slice(0, 5);

        return {
            totalRecords,
            totalItems,
            totalPurchasingValue: `€ ${formatPriceForDisplay(totalPurchasingValue)}`,
            totalSellingValue: `€ ${formatPriceForDisplay(totalSellingValue)}`,
            ordersNeedAttention,
            recentOrders,
            lowStockCount: lowStockRecords.length,
            filteredOrderCount: currentOrderCount,
            revenue: currentRevenue,
            revenueTrend,
            orderCountTrend,
            dateRangeLabel: dateRangeOptions.find(o => o.value === dateRange)?.label || "",
        };
    }, [records, orders, user, dateRange, getDateCutoff, getPreviousPeriodCutoff, distributor]);

    // Viewer stats
    const viewerStats = useMemo(() => {
      if (user?.role !== 'viewer') return null;

      // This would need orders for the viewer - for now we'll show what we have
      return {
        pendingOrdersCount: 0, // Would need to fetch viewer's orders
        favoritesCount: user.favorites?.length || 0,
      };
    }, [user]);

    useEffect(() => {
        if (!authLoading && user?.role === 'superadmin') {
            router.replace('/admin/dashboard');
        }
    }, [user, authLoading, router]);


    if (authLoading || !user) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    // Super Admin has a dedicated dashboard, show a loading/redirecting state.
    if (user.role === 'superadmin') {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Redirecting to Admin Dashboard...</p></div>;
    }

    const greeting = user.firstName ? `Welcome back, ${user.firstName}!` : "Welcome back!";

    // CLIENT (VIEWER) DASHBOARD
    if (user.role === 'viewer') {
      return (
        <div className="space-y-8">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">{greeting}</h2>
                <p className="text-muted-foreground">Discover new arrivals and manage your collection.</p>
            </div>

            {/* Quick Stats for Viewer */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Your Favorites"
                value={viewerStats?.favoritesCount || 0}
                subtext="Records you love"
                icon={ListChecks}
                href="/favorites"
              />
              <StatCard
                title="My Collection"
                value={user.collection?.length || 0}
                subtext="Records you own"
                icon={Library}
                href="/collection"
              />
              <StatCard
                title="Cart Items"
                value={user.cart?.length || 0}
                subtext="Ready to checkout"
                icon={ShoppingCart}
                href="/cart"
              />
              <StatCard
                title="Wishlist"
                value={user.wishlist?.length || 0}
                subtext="Records you want"
                icon={Package}
                href="/wishlist"
              />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Latest Arrivals</CardTitle>
                    <CardDescription>New records from your distributors</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingStats ? (
                        <div className="relative p-4">
                        <div className="flex space-x-4">
                            {[...Array(5)].map((_, i) => <Skeleton key={i} className="min-w-0 basis-1/5 h-80"/>)}
                        </div>
                        </div>
                    ) : latestRecords.length > 0 ? (
                        <Carousel
                        opts={{
                            align: "start",
                            loop: true,
                        }}
                        className="w-full"
                        >
                        <CarouselContent>
                            {latestRecords.map((record) => (
                            <CarouselItem key={record.id} className="basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5">
                                <div className="p-1 h-full">
                                    <RecordCard
                                        record={record}
                                        isOperator={false}
                                        isFavorite={user?.favorites?.includes(record.id)}
                                        onToggleFavorite={() => toggleFavorite(record.id)}
                                        isInInventory={true}
                                    />
                                </div>
                            </CarouselItem>
                            ))}
                        </CarouselContent>
                        <CarouselPrevious className="hidden sm:flex" />
                        <CarouselNext className="hidden sm:flex" />
                        </Carousel>
                    ) : (
                        <div className="flex items-center justify-center p-12 text-center bg-muted/50 rounded-lg">
                            <div className="space-y-2">
                            <p className="text-muted-foreground">No new records to show right now.</p>
                            <Button asChild variant="link"><Link href="/inventory">Browse Catalog</Link></Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-2">
                 <h3 className="text-2xl font-semibold tracking-tight">Quick Links</h3>
            </div>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <QuickLinkCard title="My Collection" description="View your personal record collection." href="/collection" icon={Library} />
                <QuickLinkCard title="Browse Catalog" description="See what's available." href="/inventory" icon={Package} />
                <QuickLinkCard title="My Wishlist" description="Keep track of records you want." href="/wishlist" icon={ListChecks} />
                <QuickLinkCard title="My Orders" description="Check the status of your orders." href="/my-orders" icon={ShoppingCart} />
            </div>
        </div>
      );
    }


    // MASTER/WORKER DASHBOARD
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">{greeting}</h2>
                <p className="text-muted-foreground">Here's a quick overview of your store.</p>
              </div>
              {user.role === 'master' && (
                <div className="flex gap-1 p-1 bg-muted rounded-lg">
                  {dateRangeOptions.map(option => (
                    <Button
                      key={option.value}
                      variant={dateRange === option.value ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setDateRange(option.value)}
                      className="text-xs"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {user.role === 'master' && (
                isLoadingStats ? (
                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => <Card key={`stat-skeleton-${i}`}><CardHeader className="pb-2"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/></CardHeader><CardContent><Skeleton className="h-8 w-24 bg-muted rounded-md"/><Skeleton className="h-4 w-32 bg-muted rounded-md mt-1"/></CardContent></Card>)}
                    </div>
                ) : masterStats && (
                    <>
                      {/* Period Stats */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <StatCard
                            title={`Revenue (${masterStats.dateRangeLabel})`}
                            value={`€ ${formatPriceForDisplay(masterStats.revenue)}`}
                            subtext="From paid orders"
                            icon={Euro}
                            trend={dateRange !== 'all' ? masterStats.revenueTrend : undefined}
                            trendLabel={dateRange !== 'all' ? "vs previous period" : undefined}
                          />
                          <StatCard
                            title={`Orders (${masterStats.dateRangeLabel})`}
                            value={masterStats.filteredOrderCount}
                            subtext="Total orders received"
                            icon={ShoppingCart}
                            trend={dateRange !== 'all' ? masterStats.orderCountTrend : undefined}
                            trendLabel={dateRange !== 'all' ? "vs previous period" : undefined}
                          />
                          <StatCard
                            title="Total Stock Value"
                            value={masterStats.totalSellingValue}
                            subtext={`${masterStats.totalItems} items in stock`}
                            icon={Tags}
                          />
                          <StatCard
                            title="Low Stock Alert"
                            value={masterStats.lowStockCount}
                            subtext={masterStats.lowStockCount > 0 ? "Records need restocking" : "All stock levels OK"}
                            icon={AlertCircle}
                            highlight={masterStats.lowStockCount > 0}
                            href={masterStats.lowStockCount > 0 ? "/inventory?stock=low" : undefined}
                          />
                      </div>

                      {/* Inventory Stats */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          <StatCard title="Unique Records" value={masterStats.totalRecords} subtext="Distinct titles in inventory" icon={Package} />
                          <StatCard title="Total Items" value={masterStats.totalItems} subtext="Sum of all stock" icon={Archive} />
                          <StatCard title="Purchasing Value" value={masterStats.totalPurchasingValue} subtext="Total cost of stock" icon={Euro} />
                          <StatCard
                            title="Needs Attention"
                            value={masterStats.ordersNeedAttention}
                            subtext="Pending / awaiting payment"
                            icon={Clock}
                            highlight={masterStats.ordersNeedAttention > 0}
                            href={masterStats.ordersNeedAttention > 0 ? "/orders?status=awaiting_payment" : undefined}
                          />
                      </div>
                    </>
                )
            )}

            {user.role === 'master' && masterStats && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Latest Orders</span>
                             {masterStats.ordersNeedAttention > 0 && (
                                <Link href="/orders?status=awaiting_payment" className="flex items-center gap-2 text-sm font-medium text-orange-500 hover:underline">
                                    <AlertTriangle className="h-4 w-4" />
                                    {masterStats.ordersNeedAttention} order(s) need attention
                                </Link>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {masterStats.recentOrders.length > 0 ? (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Order #</TableHead>
                                            <TableHead className="hidden sm:table-cell">Client</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="text-right">Total</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {masterStats.recentOrders.map(order => (
                                            <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/orders/${order.id}`)}>
                                                <TableCell className="font-mono text-sm">{order.orderNumber || order.id.slice(0, 8)}</TableCell>
                                                <TableCell className="hidden sm:table-cell">{order.viewerEmail}</TableCell>
                                                <TableCell>{format(new Date(order.createdAt), 'dd MMM yyyy')}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={`capitalize ${statusColors[order.status]}`}>
                                                        {order.status.replace(/_/g, ' ')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-medium">€ {formatPriceForDisplay(order.totalAmount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-4">No recent orders.</p>
                        )}
                    </CardContent>
                    {orders.length > 5 && (
                        <CardFooter>
                            <Button variant="outline" asChild><Link href="/orders">View All Orders</Link></Button>
                        </CardFooter>
                    )}
                </Card>
            )}

            <div className="space-y-2">
                 <h3 className="text-2xl font-semibold tracking-tight">Quick Links</h3>
                 <p className="text-sm text-muted-foreground">Jump right into your common tasks.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <QuickLinkCard title="Manage Inventory" description="View and edit all records." href="/inventory" icon={Package} />
                {(user.role === 'master' || user.role === 'worker') && <QuickLinkCard title="Add Vinyl" description="Scan or search for new records." href="/scan" icon={ScanLine} />}
                {(user.role === 'master' || user.role === 'worker') && <QuickLinkCard title="Handheld Scan" description="Use with a USB/Bluetooth scanner." href="/scan?action=handheld" icon={Keyboard} />}
                {(user.role === 'master' || user.role === 'worker') && <QuickLinkCard title="Quick Scan (Camera)" description="Instantly scan barcodes with your camera." href="/scan-barcode-fullscreen" icon={Barcode} />}
                {(user.role === 'master' || user.role === 'worker') && (
                  <QuickLinkCard
                    title="Incoming Orders"
                    description="Manage all incoming client orders."
                    href="/orders"
                    icon={ShoppingCart}
                    badge={masterStats?.ordersNeedAttention}
                  />
                )}
                {user.role === 'master' && <QuickLinkCard title="Order Fulfillment" description="Process and ship orders." href="/fulfillment" icon={Package} />}
                {user.role === 'master' && <QuickLinkCard title="Clients" description="View and manage client accounts." href="/clients" icon={Users} />}
                {user.role === 'master' && <QuickLinkCard title="Operators" description="Manage worker accounts." href="/operators" icon={HardHat} />}
                {user.role === 'master' && <QuickLinkCard title="Suppliers" description="Manage your suppliers." href="/suppliers" icon={Briefcase} />}
                {user.role === 'master' && <QuickLinkCard title="Statistics" description="View sales and collection insights." href="/stats" icon={BarChart3} />}
            </div>
        </div>
    );
}

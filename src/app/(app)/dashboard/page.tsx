"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Package, PackageCheck, Truck, ShoppingCart, Users, Library, ListChecks, ArrowRight, BarChart3, Building, HardHat, Briefcase, ScanLine, Archive, Tags, Euro, Barcode, Newspaper, AlertTriangle, Keyboard, TrendingUp, TrendingDown, Clock, AlertCircle, ChevronRight, CreditCard, User as UserIcon, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { VinylRecord, Order, OrderStatus, Distributor, User } from "@/types";
import { getAllInventoryRecords, getLatestRecordsFromDistributors, getRecordsByOwner, getWishlistedRecords } from "@/services/record-service";
import { getOrders, claimOrder, markOrderPacked } from "@/services/order-service";
import { getDistributorById } from "@/services/distributor-service";
import { getClientsByDistributorId } from "@/services/user-service";
import { useToast } from "@/hooks/use-toast";
import { formatPriceForDisplay, cn } from "@/lib/utils";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import RecordCard from "@/components/records/record-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, subDays, isAfter, parseISO, startOfDay, differenceInDays } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
    awaiting_approval: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
    pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    awaiting_payment: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    paid: 'bg-green-500/20 text-green-500 border-green-500/30',
    processing: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    ready_to_ship: 'bg-teal-500/20 text-teal-500 border-teal-500/30',
    shipped: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
    delivered: 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30',
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
    const [clientUsers, setClientUsers] = useState<User[]>([]);
    // Viewer-only stats: personal collection and wishlist counts, fetched on mount.
    // Previously these were read from user.collection?.length / user.wishlist?.length
    // which are fields that don't exist on User — so the cards always showed 0.
    const [viewerCollectionCount, setViewerCollectionCount] = useState<number>(0);
    const [viewerWishlistCount, setViewerWishlistCount] = useState<number>(0);

    // Orders for the operator fulfillment section — fetched separately so
    // workers (who don't run the master-only stats pipeline) can still see
    // their work list. Masters use the same array instead of refetching.
    const [fulfillmentOrders, setFulfillmentOrders] = useState<Order[]>([]);
    const [isLoadingFulfillment, setIsLoadingFulfillment] = useState(true);

    const canSeeFulfillment =
        !!user && (user.role === 'master' || (user.role === 'worker' && !!user.permissions?.canManageOrders));

     const fetchMasterStatsData = useCallback(async () => {
        if (!user || user.role !== 'master' || !user.distributorId) {
            setIsLoadingStats(false);
            return;
        }
        setIsLoadingStats(true);
        try {
            const [fetchedRecords, fetchedOrders, fetchedDistributor, fetchedClients] = await Promise.all([
                getAllInventoryRecords(user, user.distributorId),
                getOrders(user),
                getDistributorById(user.distributorId),
                getClientsByDistributorId(user.distributorId),
            ]);
            setRecords(fetchedRecords);
            setOrders(fetchedOrders);
            setDistributor(fetchedDistributor);
            setClientUsers(fetchedClients);
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
        // Fire all three queries in parallel. Personal collection + wishlist
        // failures are non-fatal so we wrap them individually and default to 0.
        const [fetchedLatest, ownedResult, wishlistResult] = await Promise.allSettled([
          getLatestRecordsFromDistributors(user.accessibleDistributorIds, 10),
          getRecordsByOwner(user.uid),
          getWishlistedRecords(user),
        ]);
        if (fetchedLatest.status === 'fulfilled') setLatestRecords(fetchedLatest.value);
        if (ownedResult.status === 'fulfilled') {
          const personalRecords = ownedResult.value.filter(r => !r.isInventoryItem && !r.isWishlist);
          setViewerCollectionCount(personalRecords.length);
        }
        if (wishlistResult.status === 'fulfilled') setViewerWishlistCount(wishlistResult.value.length);
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

    // Dedicated fulfillment fetch so the section works for workers too. For
    // masters the main `orders` state already holds this data, but we keep a
    // separate fetch to avoid coupling the master-stats load path to this
    // section (a failure in one shouldn't hide the other).
    const fetchFulfillmentOrders = useCallback(async () => {
        if (!canSeeFulfillment || !user) {
            setIsLoadingFulfillment(false);
            return;
        }
        setIsLoadingFulfillment(true);
        try {
            const fetched = await getOrders(user);
            setFulfillmentOrders(
                fetched.filter(o => ['paid', 'processing', 'ready_to_ship', 'shipped'].includes(o.status))
            );
        } catch (error) {
            console.error("DashboardPage: Failed to fetch fulfillment orders", error);
        } finally {
            setIsLoadingFulfillment(false);
        }
    }, [canSeeFulfillment, user]);

    useEffect(() => {
        if (!authLoading) fetchFulfillmentOrders();
    }, [authLoading, fetchFulfillmentOrders]);

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

        // Build a reorder-suggestions list: include days-since-last-sold and supplier info.
        const soldDatesByRecord = new Map<string, Date>();
        for (const o of orders) {
          if (o.status !== 'paid' && o.status !== 'shipped' && o.status !== 'processing') continue;
          const paidDate = o.paidAt ? parseISO(o.paidAt) : (o.createdAt ? parseISO(o.createdAt) : null);
          if (!paidDate) continue;
          for (const item of o.items || []) {
            const prior = soldDatesByRecord.get(item.recordId);
            if (!prior || paidDate > prior) soldDatesByRecord.set(item.recordId, paidDate);
          }
        }
        const reorderSuggestions = lowStockRecords
          .map(r => {
            const lastSold = soldDatesByRecord.get(r.id);
            const daysSinceSold = lastSold
              ? Math.floor((Date.now() - lastSold.getTime()) / (1000 * 60 * 60 * 24))
              : null;
            return {
              id: r.id,
              title: r.title,
              artist: r.artist,
              coverUrl: r.cover_url,
              currentStock: (Number(r.stock_shelves) || 0) + (Number(r.stock_storage) || 0),
              supplier: (r as any).supplier?.name || (r as any).supplierId || null,
              daysSinceSold,
              lastSoldAt: lastSold ? lastSold.toISOString() : null,
            };
          })
          .sort((a, b) => {
            // Prioritize: out-of-stock or recently-sold first
            const aStock = a.currentStock;
            const bStock = b.currentStock;
            if (aStock !== bStock) return aStock - bStock;
            const aSold = a.daysSinceSold ?? 999;
            const bSold = b.daysSinceSold ?? 999;
            return aSold - bSold;
          })
          .slice(0, 8);

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

        // Client stats
        const totalClients = clientUsers.length;
        const fourteenDaysAgo = subDays(new Date(), 14);
        const newClients = clientUsers.filter(c => {
            // Only count clients who accepted the invite (logged in), not pending invites
            const hasLoggedIn = c.lastLoginAt && c.createdAt &&
                Math.abs(new Date(c.lastLoginAt).getTime() - new Date(c.createdAt).getTime()) > 60000;
            if (!hasLoggedIn && c.profileComplete === false) return false;
            const date = c.invitedAt || c.createdAt;
            return date ? isAfter(parseISO(date), fourteenDaysAgo) : false;
        }).length;
        const pendingInvites = clientUsers.filter(c => {
            const hasLoggedIn = c.lastLoginAt && c.createdAt &&
                Math.abs(new Date(c.lastLoginAt).getTime() - new Date(c.createdAt).getTime()) > 60000;
            return !hasLoggedIn && c.profileComplete === false;
        }).length;

        return {
            totalRecords,
            totalItems,
            totalPurchasingValue: `€ ${formatPriceForDisplay(totalPurchasingValue)}`,
            totalSellingValue: `€ ${formatPriceForDisplay(totalSellingValue)}`,
            ordersNeedAttention,
            recentOrders,
            totalClients,
            newClients,
            pendingInvites,
            lowStockCount: lowStockRecords.length,
            reorderSuggestions,
            filteredOrderCount: currentOrderCount,
            revenue: currentRevenue,
            revenueTrend,
            orderCountTrend,
            dateRangeLabel: dateRangeOptions.find(o => o.value === dateRange)?.label || "",
        };
    }, [records, orders, user, dateRange, getDateCutoff, getPreviousPeriodCutoff, distributor, clientUsers]);

    // Fulfillment summary for the operator dashboard section.
    //
    // Hot-list priority: unassigned `paid` orders go first (FIFO so the
    // oldest one nags loudest), then orders that the CURRENT user has
    // claimed and is still working on. Workers without claimed work see
    // only the unassigned queue — which nudges them to pick one up.
    const fulfillmentSummary = useMemo(() => {
        if (!canSeeFulfillment || !user) return null;
        const today = startOfDay(new Date());

        const unassignedCount = fulfillmentOrders.filter(
            o => o.status === 'paid' && !o.assigneeUid
        ).length;
        const mineInProgressCount = fulfillmentOrders.filter(
            o =>
                o.assigneeUid === user.uid &&
                (o.status === 'processing' || o.status === 'ready_to_ship')
        ).length;
        const readyToShipCount = fulfillmentOrders.filter(o => o.status === 'ready_to_ship').length;
        const shippedTodayCount = fulfillmentOrders.filter(o => {
            if (o.status !== 'shipped' || !o.shippedAt) return false;
            return isAfter(parseISO(o.shippedAt), today);
        }).length;

        const unassignedPaid = fulfillmentOrders
            .filter(o => o.status === 'paid' && !o.assigneeUid)
            .sort((a, b) => parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime());
        const mineInProgress = fulfillmentOrders
            .filter(
                o =>
                    o.assigneeUid === user.uid &&
                    (o.status === 'processing' || o.status === 'ready_to_ship')
            )
            .sort((a, b) => parseISO(a.createdAt).getTime() - parseISO(b.createdAt).getTime());

        // Hot list (max 5): unassigned paid first (FIFO nags loudest), but
        // always reserve up to 2 slots for "mine in progress" so an operator
        // with active claims keeps seeing their own work even when the
        // unassigned queue is long.
        const mineSlots = Math.min(mineInProgress.length, 2);
        const unassignedSlots = 5 - mineSlots;
        const hotList = [
            ...unassignedPaid.slice(0, unassignedSlots),
            ...mineInProgress.slice(0, mineSlots),
        ];

        return {
            unassignedCount,
            mineInProgressCount,
            readyToShipCount,
            shippedTodayCount,
            hotList,
        };
    }, [canSeeFulfillment, fulfillmentOrders, user]);

    const handleDashboardClaim = useCallback(
        async (orderId: string) => {
            if (!user) return;
            try {
                await claimOrder(orderId, user);
                toast({ title: "Claimed", description: "You're now on this order." });
                fetchFulfillmentOrders();
            } catch (error) {
                toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
            }
        },
        [user, toast, fetchFulfillmentOrders]
    );

    const handleDashboardMarkPacked = useCallback(
        async (orderId: string) => {
            if (!user) return;
            try {
                await markOrderPacked(orderId, user);
                toast({ title: "Packed", description: "Order moved to Ready to Ship." });
                fetchFulfillmentOrders();
            } catch (error) {
                toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
            }
        },
        [user, toast, fetchFulfillmentOrders]
    );

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
                value={viewerCollectionCount}
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
                value={viewerWishlistCount}
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

            {/* Fulfillment section — visible for master + workers with
                canManageOrders. Sits at the top so the active work is the
                first thing you see after logging in. For workers who don't
                run master-stats this is the main dashboard content. */}
            {canSeeFulfillment && (
                <FulfillmentSection
                    isLoading={isLoadingFulfillment}
                    summary={fulfillmentSummary}
                    currentUserUid={user.uid}
                    onClaim={handleDashboardClaim}
                    onMarkPacked={handleDashboardMarkPacked}
                    onViewOrder={(id) => router.push(`/orders/${id}`)}
                />
            )}

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

                      {/* Reorder suggestions (low-stock detail) */}
                      {masterStats.reorderSuggestions && masterStats.reorderSuggestions.length > 0 && (
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                  <AlertCircle className="h-5 w-5 text-orange-500" />
                                  Reorder suggestions
                                </CardTitle>
                                <CardDescription>
                                  Records at or below threshold ({distributor?.lowStockThreshold || 3} units). Sorted by urgency.
                                </CardDescription>
                              </div>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href="/inventory?stock=low">
                                  View all <ArrowRight className="ml-1 h-3 w-3" />
                                </Link>
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Record</TableHead>
                                  <TableHead className="hidden sm:table-cell">Supplier</TableHead>
                                  <TableHead className="text-right">Stock</TableHead>
                                  <TableHead className="text-right hidden md:table-cell">Last sold</TableHead>
                                  <TableHead className="w-10"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {masterStats.reorderSuggestions.map(r => (
                                  <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/records/${r.id}`)}>
                                    <TableCell>
                                      <div className="flex items-center gap-2 min-w-0">
                                        {r.coverUrl && (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={r.coverUrl} alt="" className="h-8 w-8 rounded object-cover flex-shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                          <p className="font-medium truncate">{r.title}</p>
                                          <p className="text-xs text-muted-foreground truncate">{r.artist}</p>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{r.supplier || '—'}</TableCell>
                                    <TableCell className="text-right">
                                      <Badge variant={r.currentStock <= 1 ? "destructive" : "outline"} className="font-mono">
                                        {r.currentStock}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right hidden md:table-cell text-sm text-muted-foreground">
                                      {r.daysSinceSold === null ? "—" : `${r.daysSinceSold}d ago`}
                                    </TableCell>
                                    <TableCell>
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      )}

                      {/* Client Stats */}
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                          <StatCard title="Total Clients" value={masterStats.totalClients} subtext="Active client accounts" icon={Users} href="/clients" />
                          <StatCard
                            title="New Clients (14d)"
                            value={masterStats.newClients}
                            subtext={masterStats.newClients > 0 ? "Recently joined" : "No new clients"}
                            icon={Users}
                            highlight={masterStats.newClients > 0}
                            href="/clients"
                          />
                          <StatCard
                            title="Pending Invites"
                            value={masterStats.pendingInvites}
                            subtext={masterStats.pendingInvites > 0 ? "Awaiting acceptance" : "All invites accepted"}
                            icon={Clock}
                            highlight={masterStats.pendingInvites > 0}
                            href="/clients?status=pending"
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

// ----------------------------------------------------------------------
// FulfillmentSection — operator-only dashboard card
// ----------------------------------------------------------------------

interface FulfillmentSectionProps {
  isLoading: boolean;
  summary: {
    unassignedCount: number;
    mineInProgressCount: number;
    readyToShipCount: number;
    shippedTodayCount: number;
    hotList: Order[];
  } | null;
  currentUserUid: string;
  onClaim: (orderId: string) => void;
  onMarkPacked: (orderId: string) => void;
  onViewOrder: (orderId: string) => void;
}

// Compact mini-tile for the 4 counts at the top of the section. Lighter
// than the main StatCard because we're rendering 4 in a tight grid.
function FulfillmentTile({
  icon: Icon,
  label,
  count,
  tone,
  highlight,
  href,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  tone: string;
  highlight?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-colors",
        highlight ? "border-orange-300 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20" : "bg-background",
        href && "hover:border-primary cursor-pointer"
      )}
    >
      <div className={cn("p-2 rounded-lg shrink-0", tone)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-2xl font-bold leading-none">{count}</div>
        <div className="text-[11px] text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

// Same deterministic colour scheme as the kanban card's assignee chip —
// keeps the same collaborator recognisable by colour across the app.
function dashboardAssigneeInitials(email: string | undefined | null): string {
  if (!email) return "?";
  const local = email.split("@")[0] || email;
  const bits = local.split(/[._-]/).filter(Boolean);
  if (bits.length === 0) return local.slice(0, 2).toUpperCase();
  if (bits.length === 1) return bits[0].slice(0, 2).toUpperCase();
  return (bits[0][0] + bits[1][0]).toUpperCase();
}
function dashboardAssigneeTone(email: string | undefined | null): string {
  if (!email) return "bg-muted text-muted-foreground";
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) & 0xffffffff;
  const palette = [
    "bg-rose-100 text-rose-700",
    "bg-orange-100 text-orange-700",
    "bg-amber-100 text-amber-700",
    "bg-lime-100 text-lime-700",
    "bg-emerald-100 text-emerald-700",
    "bg-teal-100 text-teal-700",
    "bg-sky-100 text-sky-700",
    "bg-indigo-100 text-indigo-700",
    "bg-fuchsia-100 text-fuchsia-700",
    "bg-pink-100 text-pink-700",
  ];
  return palette[Math.abs(hash) % palette.length];
}

function FulfillmentSection({
  isLoading,
  summary,
  currentUserUid,
  onClaim,
  onMarkPacked,
  onViewOrder,
}: FulfillmentSectionProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Fulfillment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-32 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) return null;

  const hasWork = summary.hotList.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Fulfillment
            </CardTitle>
            <CardDescription>
              Orders waiting to be picked up, packed, and shipped.
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/fulfillment">
              See all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FulfillmentTile
            icon={UserIcon}
            label="Unassigned"
            count={summary.unassignedCount}
            tone="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            highlight={summary.unassignedCount > 0}
            href="/fulfillment"
          />
          <FulfillmentTile
            icon={Package}
            label="My in progress"
            count={summary.mineInProgressCount}
            tone="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
            href="/fulfillment"
          />
          <FulfillmentTile
            icon={PackageCheck}
            label="Ready to ship"
            count={summary.readyToShipCount}
            tone="bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
            highlight={summary.readyToShipCount > 0}
            href="/fulfillment"
          />
          <FulfillmentTile
            icon={CheckCircle2}
            label="Shipped today"
            count={summary.shippedTodayCount}
            tone="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
          />
        </div>

        {hasWork ? (
          <div className="border rounded-lg divide-y">
            {summary.hotList.map(order => {
              const orderAge = differenceInDays(new Date(), parseISO(order.createdAt));
              const isMine = order.assigneeUid === currentUserUid;
              const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);

              // Action per row: unassigned paid → Claim, mine processing →
              // Mark packed, mine ready_to_ship → link to /fulfillment
              // (shipping needs the carrier/tracking dialog which lives
              // there — no dialog on the dashboard to keep it lean).
              let action: React.ReactNode = null;
              if (!order.assigneeUid && order.status === 'paid') {
                action = (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); onClaim(order.id); }}
                  >
                    Claim
                  </Button>
                );
              } else if (isMine && order.status === 'processing') {
                action = (
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); onMarkPacked(order.id); }}
                  >
                    Mark packed
                  </Button>
                );
              } else if (isMine && order.status === 'ready_to_ship') {
                action = (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Link href="/fulfillment">Ship →</Link>
                  </Button>
                );
              }

              return (
                <div
                  key={order.id}
                  className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => onViewOrder(order.id)}
                >
                  {/* Assignee chip */}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={cn(
                            "inline-flex items-center justify-center h-7 w-7 rounded-full text-[10px] font-semibold shrink-0",
                            dashboardAssigneeTone(order.assigneeEmail),
                            isMine && "ring-2 ring-primary ring-offset-1"
                          )}
                        >
                          {order.assigneeUid ? dashboardAssigneeInitials(order.assigneeEmail) : <UserIcon className="h-3 w-3" />}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {order.assigneeUid
                          ? isMine ? "You" : order.assigneeEmail
                          : "Unassigned"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  {/* Order identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium truncate">
                        {order.orderNumber || order.id.slice(0, 8)}
                      </span>
                      <Badge variant="outline" className={`text-[10px] capitalize ${statusColors[order.status]}`}>
                        {order.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {order.customerName} · {totalItems} item{totalItems !== 1 ? 's' : ''} · €{formatPriceForDisplay(order.totalAmount)}
                    </div>
                  </div>

                  {/* Age badge — signals which orders are getting stale */}
                  {orderAge > 0 && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        orderAge > 3
                          ? "bg-red-100 text-red-700 border-red-200"
                          : orderAge > 1
                          ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                          : ""
                      )}
                    >
                      <Clock className="h-3 w-3 mr-1" />{orderAge}d
                    </Badge>
                  )}

                  {action}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="border rounded-lg p-6 text-center text-sm text-muted-foreground">
            {summary.unassignedCount === 0 && summary.mineInProgressCount === 0
              ? "All caught up — nothing to do right now."
              : "No priority orders. Open Fulfillment for the full board."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

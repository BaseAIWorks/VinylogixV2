
"use client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Package, Euro, Music2, AlertTriangle, ShoppingCart, Tags, Loader2, Archive, ListMusic, UserCheck, UserX, DollarSign, TrendingUp, List, Clock, Target } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getAllInventoryRecords, getRecordById } from "@/services/record-service";
import { getOrders } from "@/services/order-service";
import { getUsersByDistributorId, getClientsByDistributorId } from "@/services/user-service";
import type { VinylRecord, User, Order, WorkerPermissions } from "@/types";
import { format, parseISO, startOfWeek, startOfMonth, startOfYear, isWithinInterval, subDays, subMonths } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPriceForDisplay } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import Image from "next/image";
import Link from "next/link";


interface DatedRecordData {
  period: string; 
  records: number;
}

const formatDateSafe = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'PPp');
    } catch (e) {
      return 'Invalid Date';
    }
};

const StatCard = ({ title, value, subtext, icon: Icon, href }: { title: string, value: string | number, subtext: string, icon: React.ElementType, href?: string }) => {
    const content = (
      <Card className={href ? "hover:bg-muted/50 transition-colors" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              <Icon className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
              <div className="text-3xl font-bold text-primary">{value}</div>
              <p className="text-xs text-muted-foreground">{subtext}</p>
          </CardContent>
      </Card>
    );

    if (href) {
      return <Link href={href}>{content}</Link>
    }
    return content;
};


const InteractiveBreakdownCard = ({ title, data, showAll, setShowAll, icon: Icon, onCategoryClick, categoryType }: { title: string, data: {name: string, value: number}[], showAll: boolean, setShowAll: (val: boolean) => void, icon: React.ElementType, onCategoryClick: (type: 'genre' | 'format', value: string) => void, categoryType: 'genre' | 'format' }) => {
    const maxValue = useMemo(() => Math.max(...data.map(d => d.value), 0), [data]);
    const visibleData = showAll ? data : data.slice(0, 5);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6 text-primary" />
                    <CardTitle>{title}</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {data.length > 0 ? (
                    <div className="space-y-1">
                        {visibleData.map(item => (
                            <button key={item.name} onClick={() => onCategoryClick(categoryType, item.name)} className="w-full text-left rounded-md p-1.5 -m-1.5 hover:bg-muted/50 transition-colors group">
                                <div className="grid grid-cols-[minmax(0,1.5fr),minmax(0,2fr)] sm:grid-cols-[1fr,2fr] items-center gap-4 text-sm w-full">
                                    <p className="truncate text-left text-muted-foreground group-hover:text-foreground">{item.name}</p>
                                    <div className="h-6 w-full bg-secondary rounded-md">
                                        <div 
                                            className="flex h-full items-center justify-end sm:justify-start rounded-md bg-primary px-2"
                                            style={{ width: `${(item.value / maxValue) * 100}%` }}
                                        >
                                            <span className="overflow-hidden whitespace-nowrap font-medium text-primary-foreground text-xs sm:text-sm">{item.value}</span>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {data.length > 5 && (
                            <Button variant="link" onClick={() => setShowAll(!showAll)} className="p-0 h-auto text-primary mt-2">
                                {showAll ? 'Show less' : 'Show more...'}
                            </Button>
                        )}
                    </div>
                ) : <p className="text-sm text-muted-foreground">No data available.</p>}
            </CardContent>
        </Card>
    );
};


export default function StatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // State for all users
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [recordsPeriod, setRecordsPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [salesPeriod, setSalesPeriod] = useState<'week' | 'month' | 'all'>('week');

  const [showAllGenres, setShowAllGenres] = useState(false);
  const [showAllFormats, setShowAllFormats] = useState(false);
  const [showAllClients, setShowAllClients] = useState(false);
  const [showAllOperators, setShowAllOperators] = useState(false);

  // State for favorites dialog
  const [isFavoritesDialogOpen, setIsFavoritesDialogOpen] = useState(false);
  const [selectedViewer, setSelectedViewer] = useState<User | null>(null);
  const [favoriteRecords, setFavoriteRecords] = useState<VinylRecord[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);
  

  useEffect(() => {
    if (!authLoading && user && user.role !== 'master') {
      router.replace('/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchAndProcessData = useCallback(async () => {
    if (!user || user.role !== 'master' || !user.distributorId) {
      setIsLoadingStats(false);
      return;
    }
    setIsLoadingStats(true);
    setStatsError(null);
    try {
      const [fetchedRecords, fetchedOrders, operators, clients] = await Promise.all([
          getAllInventoryRecords(user, user.distributorId),
          getOrders(user),
          getUsersByDistributorId(user.distributorId),
          getClientsByDistributorId(user.distributorId)
      ]);
      setRecords(fetchedRecords);
      setOrders(fetchedOrders);
      setAllUsers([...operators, ...clients]); // Combine operators and clients
    } catch (error) {
      console.error("StatsPage: Failed to fetch data:", error);
      setStatsError("Could not load data for statistics. Please try again.");
      toast({
        title: "Statistics Error",
        description: `Failed to load data. ${(error as Error).message}`,
        variant: "destructive"
      });
    } finally {
      setIsLoadingStats(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchAndProcessData();
    }
  }, [user, authLoading, fetchAndProcessData]);

  useEffect(() => {
    const fetchFavorites = async () => {
        if (!selectedViewer || !selectedViewer.favorites || selectedViewer.favorites.length === 0) {
            setFavoriteRecords([]);
            return;
        }
        setIsLoadingFavorites(true);
        try {
            const recordPromises = selectedViewer.favorites.map(id => getRecordById(id));
            const results = await Promise.all(recordPromises);
            setFavoriteRecords(results.filter(Boolean) as VinylRecord[]);
        } catch (error) {
            console.error("Error fetching favorite records:", error);
            toast({ title: "Error", description: "Could not load favorite records.", variant: "destructive" });
        } finally {
            setIsLoadingFavorites(false);
        }
    };

    if (isFavoritesDialogOpen && selectedViewer) {
        fetchFavorites();
    }
  }, [isFavoritesDialogOpen, selectedViewer, toast]);


  const {
    totalRecords, totalItems, totalPurchasingValue, totalSellingValue,
    recordsOverTimeData, genreDistribution, formatDistribution, 
    workerStats, viewerStats,
    salesStats, pendingOrders, awaitingPaymentOrders, mostProfitableRecords, topSellingRecords, topStockedRecords
  } = useMemo(() => {
    const inventoryRecords = records.filter(r => r.isInventoryItem);
    const clients = allUsers.filter(u => u.accessibleDistributorIds?.includes(user?.distributorId || ''));
    const operators = allUsers.filter(u => u.distributorId === user?.distributorId && (u.role === 'master' || u.role === 'worker'));

    const totalRecords = inventoryRecords.length;
    
    const totalItems = inventoryRecords.reduce((sum, r) => {
        const shelves = Number(r.stock_shelves || 0);
        const storage = Number(r.stock_storage || 0);
        return sum + shelves + storage;
    }, 0);
    
    const perms: Partial<WorkerPermissions> = user?.permissions || {};
    const canViewPurchasing = user?.role === 'master' || (user?.role === 'worker' && (perms.canViewPurchasingPrice || perms.canEditPurchasingPrice));
    const canViewSelling = user?.role === 'master' || (user?.role === 'worker' && (perms.canViewSellingPrice || perms.canEditSellingPrice));

    const totalPurchasingValue = canViewPurchasing ? inventoryRecords.reduce((sum, r) => {
        const totalStock = Number(r.stock_shelves || 0) + Number(r.stock_storage || 0);
        return sum + ((r.purchasingPrice || 0) * totalStock);
    }, 0) : 0;

    const totalSellingValue = canViewSelling ? inventoryRecords.reduce((sum, r) => {
        const totalStock = Number(r.stock_shelves || 0) + Number(r.stock_storage || 0);
        return sum + ((r.sellingPrice || 0) * totalStock);
    }, 0) : 0;

    const genreCounts: { [key: string]: number } = {};
    const formatCounts: { [key: string]: number } = {};
    inventoryRecords.forEach(record => {
      if (Array.isArray(record.genre)) {
        record.genre.forEach(g => { genreCounts[g] = (genreCounts[g] || 0) + 1; });
      }
      record.formatDetails?.split(',').forEach(f => { const format = f.trim(); if(format) formatCounts[format] = (formatCounts[format] || 0) + 1; });
    });
    const genreDistribution = Object.entries(genreCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    const formatDistribution = Object.entries(formatCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

    const recordsOverTimeCounts: { [key: string]: { date: Date, count: number, label: string } } = {};
    inventoryRecords.forEach(record => {
        try {
            const date = parseISO(record.added_at);
            let periodKey: string; let label: string; let periodDate: Date;
            switch (recordsPeriod) {
                case 'daily': 
                    periodDate = date;
                    periodKey = format(periodDate, 'yyyy-MM-dd');
                    label = format(periodDate, 'MMM d, yyyy'); 
                    break;
                case 'weekly': 
                    periodDate = startOfWeek(date, { weekStartsOn: 1 });
                    periodKey = format(periodDate, 'yyyy-ww');
                    label = `W/C ${format(periodDate, 'MMM d')}`; 
                    break;
                case 'yearly': 
                    periodDate = startOfYear(date);
                    periodKey = format(periodDate, 'yyyy');
                    label = periodKey; 
                    break;
                case 'monthly': 
                default:
                    periodDate = startOfMonth(date);
                    periodKey = format(periodDate, 'yyyy-MM');
                    label = format(periodDate, 'MMM yyyy'); 
                    break;
            }
            if (!recordsOverTimeCounts[periodKey]) {
                recordsOverTimeCounts[periodKey] = { date: periodDate, count: 0, label: label };
            }
            recordsOverTimeCounts[periodKey].count++;
        } catch (e) { console.warn(`Could not parse date ${record.added_at} for record ${record.id}`); }
    });
    
    const recordsOverTimeData = Object.values(recordsOverTimeCounts)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(item => ({ period: item.label, records: item.count }));


    const recordCountsByEmail: Record<string, number> = {};
    records.forEach(record => { if (record.added_by_email) { recordCountsByEmail[record.added_by_email] = (recordCountsByEmail[record.added_by_email] || 0) + 1; } });
    const workerStats = operators.map(w => ({ ...w, recordsAdded: recordCountsByEmail[w.email || ''] || 0 }));
    const viewerStats = clients;

    const now = new Date();
    const paidOrders = orders.filter(o => o.status === 'paid');
    const getStatsForPeriod = (startDate: Date) => {
        const filtered = paidOrders.filter(o => isWithinInterval(parseISO(o.createdAt), { start: startDate, end: now }));
        return {
            revenue: filtered.reduce((sum, o) => sum + o.totalAmount, 0),
            count: filtered.length,
        };
    };
    const salesStats = {
        week: getStatsForPeriod(subDays(now, 7)),
        month: getStatsForPeriod(subDays(now, 30)),
        all: {
            revenue: paidOrders.reduce((sum, o) => sum + o.totalAmount, 0),
            count: paidOrders.length,
        }
    };
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const awaitingPaymentOrders = orders.filter(o => o.status === 'awaiting_payment').length;

    const mostProfitableRecords = inventoryRecords
        .filter(r => (r.sellingPrice ?? 0) > 0 && (r.purchasingPrice ?? 0) > 0)
        .map(r => ({
            ...r,
            margin: (r.sellingPrice ?? 0) - (r.purchasingPrice ?? 0)
        }))
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 10);

    const salesByRecord = new Map<string, { record: VinylRecord, quantity: number, revenue: number }>();
    const oneMonthAgo = subMonths(new Date(), 1);

    orders
      .filter(o => o.status === 'paid' && isWithinInterval(parseISO(o.createdAt), { start: oneMonthAgo, end: new Date() }))
      .forEach(order => {
        order.items.forEach(item => {
          const recordInfo = inventoryRecords.find(r => r.id === item.recordId);
          if (recordInfo) {
            const existing = salesByRecord.get(item.recordId);
            if (existing) {
              existing.quantity += item.quantity;
              existing.revenue += item.quantity * item.priceAtTimeOfOrder;
            } else {
              salesByRecord.set(item.recordId, {
                record: recordInfo,
                quantity: item.quantity,
                revenue: item.quantity * item.priceAtTimeOfOrder,
              });
            }
          }
        });
      });

    const topSellingRecords = Array.from(salesByRecord.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    const topStockedRecords = inventoryRecords
        .map(r => ({
            ...r,
            totalStock: (Number(r.stock_shelves) || 0) + (Number(r.stock_storage) || 0)
        }))
        .sort((a, b) => b.totalStock - a.totalStock)
        .slice(0, 20);

    return { 
        totalRecords, totalItems, totalPurchasingValue, totalSellingValue, 
        recordsOverTimeData, genreDistribution, formatDistribution, 
        workerStats, viewerStats,
        salesStats, pendingOrders, awaitingPaymentOrders, mostProfitableRecords, topSellingRecords, topStockedRecords
    };
  }, [records, orders, recordsPeriod, allUsers, user]);

  const handleOpenFavoritesDialog = (viewer: User) => {
    setSelectedViewer(viewer);
    setIsFavoritesDialogOpen(true);
  };
  
  const handleCategoryClick = (type: 'genre' | 'format', value: string) => {
    const params = new URLSearchParams();
    params.set(type, value);
    router.push(`/inventory?${params.toString()}`);
  };

  const visibleClients = showAllClients ? viewerStats : viewerStats.slice(0, 5);
  const visibleOperators = showAllOperators ? workerStats : workerStats.slice(0, 5);


  if (authLoading) {
    return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg">Loading user data...</p></div>;
  }

  if (!user || user.role !== 'master') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><h2 className="text-2xl font-semibold text-destructive">Access Denied</h2><p className="text-muted-foreground mt-2">You do not have permission to view this page.</p><Button onClick={() => router.push('/dashboard')} className="mt-6">Go to Dashboard</Button></div>
    );
  }
  
  if (isLoadingStats) {
     return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3 text-lg">Loading statistics...</p></div>;
  }

  if (statsError) {
    return ( <div className="flex flex-col items-center justify-center h-full text-center p-6"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><h2 className="text-2xl font-semibold text-destructive">Error Loading Statistics</h2><p className="text-muted-foreground mt-2">{statsError}</p><Button onClick={() => window.location.reload()} className="mt-6">Retry</Button></div> );
  }

  return (
    <div className="space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Unique Records" value={totalRecords} subtext="Number of distinct titles" icon={Package} />
            <StatCard title="Total Items in Stock" value={totalItems} subtext="Sum of all quantities" icon={Archive} />
            <StatCard title="Purchasing Value" value={`€${formatPriceForDisplay(totalPurchasingValue)}`} subtext="Total cost of acquisition" icon={ShoppingCart} />
            <StatCard title="Selling Value" value={`€${formatPriceForDisplay(totalSellingValue)}`} subtext="Potential resale value" icon={Tags} />
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <InteractiveBreakdownCard title="Genre Breakdown" data={genreDistribution} showAll={showAllGenres} setShowAll={setShowAllGenres} icon={Music2} onCategoryClick={handleCategoryClick} categoryType="genre" />
         <InteractiveBreakdownCard title="Format Breakdown" data={formatDistribution} showAll={showAllFormats} setShowAll={setShowAllFormats} icon={ListMusic} onCategoryClick={handleCategoryClick} categoryType="format" />
      </div>
      
      <Card>
          <CardHeader>
              <CardTitle>Records Added Over Time</CardTitle>
              <Tabs value={recordsPeriod} onValueChange={(value) => setRecordsPeriod(value as any)} className="mt-2">
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
                      <TabsTrigger value="daily">Daily</TabsTrigger>
                      <TabsTrigger value="weekly">Weekly</TabsTrigger>
                      <TabsTrigger value="monthly">Monthly</TabsTrigger>
                      <TabsTrigger value="yearly">Yearly</TabsTrigger>
                  </TabsList>
              </Tabs>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ChartContainer config={{ records: { label: "Records Added", color: "hsl(var(--primary))" } }} className="w-full h-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart accessibilityLayer data={recordsOverTimeData}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3"/>
                          <XAxis dataKey="period" tickLine={false} tickMargin={10} axisLine={false} />
                          <YAxis allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent formatter={(value, name, props) => (<div className="flex flex-col gap-0.5"><span className="font-medium text-foreground">{props.payload.period}</span><span className="text-muted-foreground">Records: {value}</span></div>)} />} />
                          <Bar dataKey="records" fill="var(--color-records)" radius={4} />
                      </BarChart>
                  </ResponsiveContainer>
              </ChartContainer>
          </CardContent>
      </Card>
      
      <div className="space-y-6">
          <h3 className="text-2xl font-bold tracking-tight text-foreground">Sales & Product Performance</h3>
           <Card>
               <CardHeader>
                  <div className="flex items-center gap-3">
                      <DollarSign className="h-6 w-6 text-primary" />
                      <CardTitle>Sales Performance</CardTitle>
                  </div>
                  <Tabs value={salesPeriod} onValueChange={(value) => setSalesPeriod(value as any)}>
                      <TabsList className="grid w-full grid-cols-3 mt-2">
                          <TabsTrigger value="week">Last 7 Days</TabsTrigger>
                          <TabsTrigger value="month">Last 30 Days</TabsTrigger>
                          <TabsTrigger value="all">All Time</TabsTrigger>
                      </TabsList>
                  </Tabs>
               </CardHeader>
               <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="flex flex-col items-center justify-center p-6 border rounded-lg">
                         <DollarSign className="h-8 w-8 text-muted-foreground mb-2"/>
                         <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                         <p className="text-4xl font-bold text-primary">€{formatPriceForDisplay(salesStats[salesPeriod].revenue)}</p>
                      </div>
                      <div className="flex flex-col items-center justify-center p-6 border rounded-lg">
                         <TrendingUp className="h-8 w-8 text-muted-foreground mb-2"/>
                         <p className="text-sm font-medium text-muted-foreground">Total Paid Orders</p>
                         <p className="text-4xl font-bold text-primary">{salesStats[salesPeriod].count}</p>
                      </div>
                  </div>
               </CardContent>
          </Card>
          <div className="grid grid-cols-2 gap-6">
              <StatCard title="Pending Orders" value={pendingOrders} subtext="Awaiting processing" icon={List} href="/orders?status=pending" />
              <StatCard title="Awaiting Payment" value={awaitingPaymentOrders} subtext="Waiting for client payment" icon={Clock} href="/orders?status=awaiting_payment" />
          </div>
          <Card>
              <CardHeader>
                  <div className="flex items-center gap-3">
                      <Target className="h-6 w-6 text-primary" />
                      <CardTitle>Top Products</CardTitle>
                  </div>
              </CardHeader>
               <CardContent>
                   <Tabs defaultValue="margin">
                      <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
                         <TabsTrigger value="margin">By Margin</TabsTrigger>
                         <TabsTrigger value="sales">By Sales (Last 30 Days)</TabsTrigger>
                         <TabsTrigger value="stock">By Stock</TabsTrigger>
                      </TabsList>
                      <TabsContent value="margin" className="pt-4">
                          <CardDescription className="mb-4">Top 10 records by profit margin per item.</CardDescription>
                          <div className="overflow-x-auto">
                              {mostProfitableRecords.length > 0 ? (
                                  <Table>
                                      <TableHeader><TableRow><TableHead>Record</TableHead><TableHead className="text-right hidden sm:table-cell">Margin</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {mostProfitableRecords.map(r => (
                                              <TableRow key={r.id}>
                                                  <TableCell className="py-2 px-4">
                                                      <p className="font-medium">{r.title}</p>
                                                      <p className="text-sm text-muted-foreground">{r.artist}</p>
                                                  </TableCell>
                                                  <TableCell className="text-right font-medium py-2 px-4 hidden sm:table-cell">€{formatPriceForDisplay(r.margin)}</TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              ) : (
                                  <p className="text-sm text-center text-muted-foreground py-4">No records with both purchase and selling price found.</p>
                              )}
                          </div>
                      </TabsContent>
                      <TabsContent value="sales" className="pt-4">
                          <CardDescription className="mb-4">Top 10 records by total revenue in the last 30 days.</CardDescription>
                          <div className="overflow-x-auto">
                              {topSellingRecords.length > 0 ? (
                                  <Table>
                                      <TableHeader><TableRow><TableHead>Record</TableHead><TableHead className="text-center hidden sm:table-cell">Qty</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {topSellingRecords.map(item => (
                                              <TableRow key={item.record.id}>
                                                  <TableCell className="py-2 px-4">
                                                      <p className="font-medium">{item.record.title}</p>
                                                      <p className="text-sm text-muted-foreground">{item.record.artist}</p>
                                                  </TableCell>
                                                  <TableCell className="text-center py-2 px-4 hidden sm:table-cell">{item.quantity}</TableCell>
                                                  <TableCell className="text-right font-medium py-2 px-4">€{formatPriceForDisplay(item.revenue)}</TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              ) : (
                                  <p className="text-sm text-center text-muted-foreground py-4">No sales in the last 30 days.</p>
                              )}
                          </div>
                      </TabsContent>
                      <TabsContent value="stock" className="pt-4">
                          <CardDescription className="mb-4">Top 20 records by total items in stock.</CardDescription>
                           <div className="overflow-x-auto">
                              {topStockedRecords.length > 0 ? (
                                  <Table>
                                      <TableHeader><TableRow><TableHead>Record</TableHead><TableHead className="text-right">Total Stock</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {topStockedRecords.map(r => (
                                              <TableRow key={r.id}>
                                                  <TableCell className="py-2 px-4">
                                                      <p className="font-medium">{r.title}</p>
                                                      <p className="text-sm text-muted-foreground">{r.artist}</p>
                                                  </TableCell>
                                                  <TableCell className="text-right font-medium py-2 px-4">{r.totalStock}</TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              ) : (
                                  <p className="text-sm text-center text-muted-foreground py-4">No inventory records found.</p>
                              )}
                          </div>
                      </TabsContent>
                   </Tabs>
              </CardContent>
          </Card>
      </div>

      <div>
          <h3 className="text-2xl font-bold tracking-tight text-foreground mb-4">User Statistics</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader><div className="flex items-center gap-3"><UserCheck className="h-6 w-6 text-primary" /><CardTitle>Operator Activity</CardTitle></div></CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader><TableRow><TableHead>Email</TableHead><TableHead className="hidden sm:table-cell">Records Added</TableHead><TableHead className="hidden md:table-cell">Last Login</TableHead></TableRow></TableHeader>
                            <TableBody>{visibleOperators.map(w => <TableRow key={w.uid}><TableCell>{w.email}</TableCell><TableCell className="hidden sm:table-cell">{w.recordsAdded}</TableCell><TableCell className="hidden md:table-cell">{formatDateSafe(w.lastLoginAt)}</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </div>
                    {workerStats.length > 5 && (
                        <Button variant="link" onClick={() => setShowAllOperators(!showAllOperators)} className="p-0 h-auto text-primary mt-2">
                            {showAllOperators ? 'Show less' : `Show ${workerStats.length - 5} more...`}
                        </Button>
                    )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><div className="flex items-center gap-3"><Users className="h-6 w-6 text-primary" /><CardTitle>Client Activity</CardTitle></div></CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader><TableRow><TableHead>Email</TableHead><TableHead className="hidden sm:table-cell">Favorites</TableHead><TableHead className="hidden md:table-cell">Last Login</TableHead></TableRow></TableHeader>
                            <TableBody>{visibleClients.map(v => <TableRow key={v.uid}><TableCell>{v.email}</TableCell><TableCell className="hidden sm:table-cell"><Button variant="link" className="p-0 h-auto" onClick={() => handleOpenFavoritesDialog(v)}>{v.favorites?.length || 0}</Button></TableCell><TableCell className="hidden md:table-cell">{formatDateSafe(v.lastLoginAt)}</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </div>
                    {viewerStats.length > 5 && (
                        <Button variant="link" onClick={() => setShowAllClients(!showAllClients)} className="p-0 h-auto text-primary mt-2">
                            {showAllClients ? 'Show less' : `Show ${viewerStats.length - 5} more...`}
                        </Button>
                    )}
                </CardContent>
              </Card>
          </div>
      </div>

      <Dialog open={isFavoritesDialogOpen} onOpenChange={setIsFavoritesDialogOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Favorites for {selectedViewer?.email}</DialogTitle><DialogDescription>A list of records this client has marked as a favorite.</DialogDescription></DialogHeader><div className="max-h-[60vh] overflow-y-auto pr-4">{isLoadingFavorites ? <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : favoriteRecords.length > 0 ? (<ul className="space-y-3">{favoriteRecords.map(record => (<li key={record.id}><Link href={`/records/${record.id}`} className="flex items-center gap-4 p-2 -m-2 rounded-md hover:bg-muted/50"><Image src={record.cover_url || `https://placehold.co/64x64.png`} alt={record.title} width={64} height={64} className="rounded-md aspect-square object-cover" data-ai-hint="album cover" unoptimized={record.cover_url?.includes('discogs.com')} /><div className="flex-1"><p className="font-semibold">{record.title}</p><p className="text-sm text-muted-foreground">{record.artist}</p></div></Link></li>))}</ul>) : <p className="text-sm text-muted-foreground text-center py-10">This client has no favorites.</p>}</div></DialogContent></Dialog>
      
    </div>
  );
}


"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ArrowLeft, Building, Users, DollarSign, TrendingUp, Package, XCircle, PieChart, LineChart, ShoppingCart, CreditCard, Wallet } from "lucide-react";
import type { Distributor, User, VinylRecord, Order } from "@/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getDistributors } from "@/services/distributor-service";
import { getAllUsers } from "@/services/admin-user-service";
import { getAllRecords } from "@/services/record-service";
import { getAllOrders } from "@/services/admin-order-service";
import { useRouter } from "next/navigation";
import { format, parseISO, subDays, isAfter, formatDistanceToNow } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart as RechartsPieChart, Pie, Cell, AreaChart, Area } from "recharts";
import { formatPriceForDisplay } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

const StatCard = ({ title, value, subtext, icon: Icon, color, href }: { title: string, value: string | number, subtext: string, icon: React.ElementType, color?: string, href?: string }) => {
    const content = (
        <Card className={`relative overflow-hidden ${color ? '' : 'bg-card'} ${href ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
            {color && <div className={`absolute top-0 left-0 h-full w-1 ${color}`} />}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pl-4 md:pl-8">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pl-4 md:pl-8">
                <div className="text-2xl md:text-3xl font-bold text-primary">{value}</div>
                <p className="text-xs text-muted-foreground">{subtext}</p>
            </CardContent>
        </Card>
    );
    if (href) return <Link href={href}>{content}</Link>;
    return content;
};

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

type DateRange = '30d' | '90d' | '365d' | 'all';

export default function AdminStatisticsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allRecords, setAllRecords] = useState<VinylRecord[]>([]);
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange>('all');
    const [topDistributorView, setTopDistributorView] = useState<'records' | 'revenue' | 'orders'>('records');

    const fetchData = useCallback(async () => {
        if (!user || user.role !== 'superadmin') {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [distributorsData, usersData, recordsData, ordersData] = await Promise.all([
                getDistributors(),
                getAllUsers(),
                getAllRecords(),
                getAllOrders(),
            ]);
            setDistributors(distributorsData);
            setAllUsers(usersData);
            setAllRecords(recordsData);
            setAllOrders(ordersData);
        } catch (error) {
            toast({ title: "Error", description: `Could not fetch platform data. ${(error as Error).message}`, variant: "destructive", duration: 7000 });
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

    const dateFilter = useMemo(() => {
        if (dateRange === 'all') return null;
        const days = dateRange === '30d' ? 30 : dateRange === '90d' ? 90 : 365;
        return subDays(new Date(), days);
    }, [dateRange]);

    const stats = useMemo(() => {
        const tierCounts: Record<string, number> = { payg: 0, essential: 0, growth: 0, scale: 0, collector: 0 };
        let monthlyRevenue = 0;
        const overdueAccounts: Distributor[] = [];
        let canceledCount = 0;

        distributors.forEach(d => {
            if (!d.isSubscriptionExempt) {
                const tier = d.subscriptionTier || d.subscription?.tier;
                const subStatus = d.subscriptionStatus || d.subscription?.status;
                if (tier && tierCounts[tier] !== undefined) {
                    tierCounts[tier]++;
                }
                if (d.status === 'active' && subStatus === 'active') {
                    monthlyRevenue += d.subscription?.discountedPrice ?? d.subscription?.price ?? 0;
                }
                if (subStatus === 'past_due') {
                    overdueAccounts.push(d);
                }
                if (subStatus === 'canceled') {
                    canceledCount++;
                }
            }
        });

        const tierChartData = Object.entries(tierCounts)
            .filter(([, value]) => value > 0)
            .map(([name, value], index) => ({ name, value, fill: COLORS[index % COLORS.length] }));

        const inventoryRecordsOnly = allRecords.filter(record => record.isInventoryItem);

        const distributorRecordCounts = inventoryRecordsOnly.reduce((acc, record) => {
            if (record.distributorId) {
                acc[record.distributorId] = (acc[record.distributorId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        // Top distributors by records
        const topByRecords = distributors
            .map(d => ({ name: d.name, value: distributorRecordCounts[d.id] || 0, id: d.id }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // Orders stats
        const paidOrders = allOrders.filter(o => o.paymentStatus === 'paid');
        const totalPlatformFees = paidOrders.reduce((sum, o) => sum + ((o.platformFeeAmount || 0) / 100), 0);
        const totalOrderRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

        // Top distributors by revenue
        const revenueByDistributor: Record<string, number> = {};
        const orderCountByDistributor: Record<string, number> = {};
        paidOrders.forEach(o => {
            revenueByDistributor[o.distributorId] = (revenueByDistributor[o.distributorId] || 0) + o.totalAmount;
            orderCountByDistributor[o.distributorId] = (orderCountByDistributor[o.distributorId] || 0) + 1;
        });

        const topByRevenue = distributors
            .map(d => ({ name: d.name, value: revenueByDistributor[d.id] || 0, id: d.id }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        const topByOrders = distributors
            .map(d => ({ name: d.name, value: orderCountByDistributor[d.id] || 0, id: d.id }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // Payment method breakdown
        const paymentMethods: Record<string, number> = {};
        paidOrders.forEach(o => {
            const method = o.paymentMethod || 'unknown';
            paymentMethods[method] = (paymentMethods[method] || 0) + 1;
        });
        const paymentMethodData = Object.entries(paymentMethods).map(([name, value], i) => ({
            name: name === 'stripe' ? 'Stripe' : name === 'paypal' ? 'PayPal' : name === 'pending' ? 'Order Request' : name,
            value,
            fill: COLORS[i % COLORS.length],
        }));

        // Distributor growth
        const filteredDistributors = dateFilter
            ? distributors.filter(d => isAfter(parseISO(d.createdAt), dateFilter))
            : distributors;

        const newSignups = dateFilter
            ? filteredDistributors.length
            : distributors.length;

        const distributorGrowthData = distributors
            .reduce((acc, d) => {
                const month = format(parseISO(d.createdAt), 'MMM yyyy');
                acc[month] = (acc[month] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        const sortedGrowthData = Object.entries(distributorGrowthData)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

        // Revenue trend (monthly)
        const revenueTrend: Record<string, number> = {};
        paidOrders.forEach(o => {
            const month = format(parseISO(o.createdAt), 'MMM yyyy');
            revenueTrend[month] = (revenueTrend[month] || 0) + o.totalAmount;
        });
        const revenueTrendData = Object.entries(revenueTrend)
            .map(([month, revenue]) => ({ month, revenue }))
            .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

        // Stock stats
        const totalItemsInStock = inventoryRecordsOnly.reduce((sum, r) => {
            const shelves = Number(r.stock_shelves);
            const storage = Number(r.stock_storage);
            return sum + (isNaN(shelves) ? 0 : shelves) + (isNaN(storage) ? 0 : storage);
        }, 0);

        const totalStockValue = inventoryRecordsOnly.reduce((sum, r) => {
            const stock = (Number(r.stock_shelves) || 0) + (Number(r.stock_storage) || 0);
            return sum + stock * (r.sellingPrice || 0);
        }, 0);

        return {
            totalDistributors: distributors.length,
            totalUsers: allUsers.length,
            monthlyRevenue,
            tierCounts,
            tierChartData,
            overdueAccounts,
            canceledCount,
            topByRecords,
            topByRevenue,
            topByOrders,
            distributorGrowthData: sortedGrowthData,
            totalInventoryRecords: inventoryRecordsOnly.length,
            totalItemsInStock,
            totalStockValue,
            totalOrders: allOrders.length,
            paidOrderCount: paidOrders.length,
            totalOrderRevenue,
            totalPlatformFees,
            paymentMethodData,
            revenueTrendData,
            newSignups,

            // Recent client signups (last 20, sorted newest first)
            recentClients: allUsers
                .filter(u => u.role === 'viewer' && u.createdAt)
                .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
                .slice(0, 20)
                .map(u => {
                    // Find which distributor(s) this client belongs to
                    const distNames = (u.accessibleDistributorIds || [])
                        .map(did => distributors.find(d => d.id === did)?.name)
                        .filter(Boolean);
                    return {
                        uid: u.uid,
                        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Unknown',
                        email: u.email || '',
                        companyName: u.companyName,
                        distributors: distNames as string[],
                        createdAt: u.createdAt!,
                        lastLoginAt: u.lastLoginAt,
                        profileComplete: u.profileComplete,
                    };
                }),
            totalClients: allUsers.filter(u => u.role === 'viewer').length,
            newClientsCount: allUsers.filter(u => {
                if (u.role !== 'viewer' || !u.createdAt) return false;
                return isAfter(parseISO(u.createdAt), subDays(new Date(), 14));
            }).length,
        };
    }, [distributors, allUsers, allRecords, allOrders, dateFilter]);

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (user?.role !== 'superadmin') {
        return <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><h2 className="text-2xl font-semibold text-destructive">Access Denied</h2><p className="text-muted-foreground mt-2">You must be a Super Admin to view this page.</p><Button onClick={() => router.push('/dashboard')} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard</Button></div>;
    }

    const topDistributors = topDistributorView === 'records' ? stats.topByRecords : topDistributorView === 'revenue' ? stats.topByRevenue : stats.topByOrders;

    return (
        <div className="space-y-8">
            {/* Date Range Filter */}
            <div className="flex items-center justify-between">
                <div />
                <div className="flex gap-1.5">
                    {(['30d', '90d', '365d', 'all'] as const).map(range => (
                        <Button key={range} variant={dateRange === range ? "default" : "outline"} size="sm" onClick={() => setDateRange(range)} className="text-xs">
                            {range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : range === '365d' ? '1 Year' : 'All Time'}
                        </Button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                 <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
                    {[...Array(8)].map((_, i) => <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-5 w-20" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-3/4 mt-1" /></CardContent></Card>)}
                </div>
            ) : (
                <>
                    {/* Row 1: Platform stats */}
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Total Distributors" value={stats.totalDistributors} subtext={`${stats.newSignups} in period`} icon={Building} color="bg-primary" />
                        <StatCard title="Total Users" value={stats.totalUsers} subtext="Across all platforms" icon={Users} color="bg-accent" />
                        <StatCard title="Est. Monthly Revenue" value={`€ ${formatPriceForDisplay(stats.monthlyRevenue)}`} subtext="From active subscriptions" icon={DollarSign} color="bg-chart-2" />
                        <StatCard title="Overdue Accounts" value={stats.overdueAccounts.length} subtext={`${stats.canceledCount} canceled`} icon={XCircle} color="bg-destructive" href="/admin/accounts?status=past_due" />
                    </div>

                    {/* Row 2: Order & inventory stats */}
                    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                        <StatCard title="Paid Orders" value={stats.paidOrderCount} subtext={`${stats.totalOrders} total incl. unpaid`} icon={ShoppingCart} color="bg-green-500" href="/admin/revenue" />
                        <StatCard title="Platform Fees Earned" value={`€ ${formatPriceForDisplay(stats.totalPlatformFees)}`} subtext="From order commissions (2-6%)" icon={Wallet} color="bg-green-600" />
                        <StatCard title="Total Clients" value={stats.totalClients} subtext={`${stats.newClientsCount} new in last 14 days`} icon={Users} color="bg-blue-500" />
                        <StatCard title="Items in Stock" value={stats.totalItemsInStock} subtext={`${stats.totalInventoryRecords} unique records · € ${formatPriceForDisplay(stats.totalStockValue)}`} icon={Package} color="bg-chart-3" />
                    </div>
                </>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5"/>Revenue Trend</CardTitle>
                        <CardDescription>Monthly order revenue over time.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       {stats.revenueTrendData.length > 0 ? (
                           <ChartContainer config={{ revenue: { label: "Revenue", color: "hsl(var(--chart-2))" } }} className="h-[250px] w-full">
                             <AreaChart data={stats.revenueTrendData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                                <YAxis tickFormatter={(v) => `€${v}`} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Area type="monotone" dataKey="revenue" fill="var(--color-revenue)" fillOpacity={0.2} stroke="var(--color-revenue)" strokeWidth={2} />
                             </AreaChart>
                           </ChartContainer>
                       ) : (
                           <p className="text-center text-muted-foreground py-8">No revenue data yet.</p>
                       )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5"/>Payment Methods</CardTitle>
                         <CardDescription>Breakdown of paid orders by method.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {stats.paymentMethodData.length > 0 ? (
                             <ChartContainer config={{}} className="mx-auto aspect-square h-[250px]">
                                <RechartsPieChart>
                                    <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                                    <Pie data={stats.paymentMethodData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                         {stats.paymentMethodData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                </RechartsPieChart>
                            </ChartContainer>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No order data yet.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Row 2 Charts: Growth + Tiers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><LineChart className="h-5 w-5"/>Distributor Growth</CardTitle>
                        <CardDescription>New distributors added over time.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <ChartContainer config={{ count: { label: "New Distributors", color: "hsl(var(--primary))" } }} className="h-[250px] w-full">
                         <RechartsBarChart data={stats.distributorGrowthData}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                            <YAxis allowDecimals={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                         </RechartsBarChart>
                       </ChartContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5"/>Subscription Tiers</CardTitle>
                         <CardDescription>Breakdown of subscription tiers.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <ChartContainer config={{}} className="mx-auto aspect-square h-[250px]">
                            <RechartsPieChart>
                                <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                                <Pie data={stats.tierChartData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5}>
                                     {stats.tierChartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                            </RechartsPieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Top Distributors */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5"/>Top Distributors</CardTitle>
                            <CardDescription>Top 10 distributors by {topDistributorView}.</CardDescription>
                        </div>
                        <div className="flex gap-1">
                            {(['records', 'revenue', 'orders'] as const).map(view => (
                                <Button key={view} variant={topDistributorView === view ? "default" : "outline"} size="sm" onClick={() => setTopDistributorView(view)} className="capitalize text-xs">
                                    {view}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                   <div className="overflow-x-auto">
                       <Table>
                           <TableHeader>
                               <TableRow>
                                   <TableHead>Distributor</TableHead>
                                   <TableHead className="text-right capitalize">{topDistributorView === 'revenue' ? 'Revenue' : topDistributorView === 'orders' ? 'Orders' : 'Records'}</TableHead>
                               </TableRow>
                           </TableHeader>
                           <TableBody>
                               {topDistributors.filter(d => d.value > 0).map(dist => (
                                   <TableRow key={dist.id} className="cursor-pointer" onClick={() => router.push(`/admin/distributors/${dist.id}`)}>
                                       <TableCell className="font-medium">{dist.name}</TableCell>
                                       <TableCell className="text-right font-mono">
                                           {topDistributorView === 'revenue' ? `€ ${formatPriceForDisplay(dist.value)}` : dist.value}
                                       </TableCell>
                                   </TableRow>
                               ))}
                               {topDistributors.filter(d => d.value > 0).length === 0 && (
                                   <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No data yet.</TableCell></TableRow>
                               )}
                           </TableBody>
                       </Table>
                   </div>
                </CardContent>
            </Card>

            {/* Recent Client Signups */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Recent Client Signups</CardTitle>
                    <CardDescription>Latest 20 clients across all distributors.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Client</TableHead>
                                    <TableHead className="hidden sm:table-cell">Company</TableHead>
                                    <TableHead>Distributor</TableHead>
                                    <TableHead className="hidden md:table-cell">Status</TableHead>
                                    <TableHead>Signed Up</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.recentClients.length > 0 ? stats.recentClients.map(client => {
                                    const hasLoggedIn = client.lastLoginAt && client.createdAt &&
                                        Math.abs(new Date(client.lastLoginAt).getTime() - new Date(client.createdAt).getTime()) > 60000;
                                    const isPending = !hasLoggedIn && client.profileComplete === false;
                                    const isNew = isAfter(parseISO(client.createdAt), subDays(new Date(), 14));
                                    return (
                                        <TableRow key={client.uid}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div>
                                                        <p className="font-medium text-sm">{client.name}</p>
                                                        <p className="text-xs text-muted-foreground">{client.email}</p>
                                                    </div>
                                                    {isNew && !isPending && (
                                                        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">New</Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{client.companyName || '-'}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {client.distributors.map(name => (
                                                        <Badge key={name} variant="secondary" className="text-[10px]">{name}</Badge>
                                                    ))}
                                                    {client.distributors.length === 0 && <span className="text-xs text-muted-foreground">-</span>}
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {isPending ? (
                                                    <Badge variant="outline" className="text-[10px] bg-amber-500/20 text-amber-600 border-amber-500/30">Invite Sent</Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-[10px] bg-green-500/20 text-green-600 border-green-500/30">Accepted</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="text-sm">{format(parseISO(client.createdAt), 'dd MMM yyyy, HH:mm')}</p>
                                                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(parseISO(client.createdAt), { addSuffix: true })}</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No clients yet.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

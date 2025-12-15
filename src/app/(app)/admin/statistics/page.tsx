
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ArrowLeft, BarChart3, Building, Users, DollarSign, TrendingUp, Package, XCircle, PieChart, LineChart, Database } from "lucide-react";
import type { Distributor, User, VinylRecord, SubscriptionTier } from "@/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getDistributors } from "@/services/distributor-service";
import { getAllUsers } from "@/services/admin-user-service";
import { getAllRecords } from "@/services/record-service";
import { useRouter } from "next/navigation";
import { format, parseISO, startOfMonth } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart as RechartsBarChart, Bar, ResponsiveContainer, XAxis, YAxis, CartesianGrid, PieChart as RechartsPieChart, Pie, Cell } from "recharts";
import { formatPriceForDisplay } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const StatCard = ({ title, value, subtext, icon: Icon, color }: { title: string, value: string | number, subtext: string, icon: React.ElementType, color?: string }) => (
    <Card className={`relative overflow-hidden ${color ? '' : 'bg-card'}`}>
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

const COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];


export default function AdminStatisticsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [allRecords, setAllRecords] = useState<VinylRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!user || user.role !== 'superadmin') {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [distributorsData, usersData, recordsData] = await Promise.all([
                getDistributors(),
                getAllUsers(),
                getAllRecords(),
            ]);
            setDistributors(distributorsData);
            setAllUsers(usersData);
            setAllRecords(recordsData);
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

    const stats = useMemo(() => {
        const tierCounts: Record<SubscriptionTier, number> = { essential: 0, growth: 0, scale: 0 };
        let monthlyRevenue = 0;
        const overdueAccounts: Distributor[] = [];

        distributors.forEach(d => {
            if (d.subscription && !d.isSubscriptionExempt) {
                if (tierCounts[d.subscription.tier] !== undefined) {
                    tierCounts[d.subscription.tier]++;
                }
                if (d.status === 'active' && d.subscription.status === 'active') {
                    monthlyRevenue += d.subscription.discountedPrice ?? d.subscription.price ?? 0;
                }
                if (d.subscription.status === 'past_due') {
                    overdueAccounts.push(d);
                }
            }
        });
        
        const tierChartData = Object.entries(tierCounts).map(([name, value], index) => ({ name, value, fill: COLORS[index % COLORS.length] }));

        const tierChartConfig = {
            essential: { label: "Essential", color: COLORS[0] },
            growth: { label: "Growth", color: COLORS[1] },
            scale: { label: "Scale", color: COLORS[2] },
        };

        const inventoryRecordsOnly = allRecords.filter(record => record.isInventoryItem);

        const distributorRecordCounts = inventoryRecordsOnly.reduce((acc, record) => {
            if (record.distributorId) {
                acc[record.distributorId] = (acc[record.distributorId] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);
        
        const topDistributorsByRecords = distributors
            .map(d => ({ name: d.name, records: distributorRecordCounts[d.id] || 0, id: d.id }))
            .sort((a, b) => b.records - a.records)
            .slice(0, 10);
            
        const distributorGrowthData = distributors
            .reduce((acc, d) => {
                const month = format(parseISO(d.createdAt), 'MMM yyyy');
                acc[month] = (acc[month] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

        const sortedGrowthData = Object.entries(distributorGrowthData)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
        
        const totalInventoryRecords = inventoryRecordsOnly.length;

        const totalItemsInStock = allRecords.filter(r => r.isInventoryItem).reduce((sum, r) => {
            const shelves = Number(r.stock_shelves);
            const storage = Number(r.stock_storage);
            const currentStock = (isNaN(shelves) ? 0 : shelves) + (isNaN(storage) ? 0 : storage);
            return sum + currentStock;
        }, 0);

        return {
            totalDistributors: distributors.length,
            totalUsers: allUsers.length,
            monthlyRevenue,
            tierCounts,
            tierChartData,
            tierChartConfig,
            overdueAccounts,
            topDistributorsByRecords,
            distributorGrowthData: sortedGrowthData,
            totalInventoryRecords,
            totalItemsInStock,
        };
    }, [distributors, allUsers, allRecords]);


    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (user?.role !== 'superadmin') {
        return <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><h2 className="text-2xl font-semibold text-destructive">Access Denied</h2><p className="text-muted-foreground mt-2">You must be a Super Admin to view this page.</p><Button onClick={() => router.push('/dashboard')} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard</Button></div>;
    }


    return (
        
            <div className="space-y-8">
                {isLoading ? (
                     <div className="grid gap-6 grid-cols-2 lg:grid-cols-5">
                        {[...Array(5)].map((_, i) => <Card key={i}><CardHeader className="pb-2"><Skeleton className="h-5 w-5 rounded-full" /></CardHeader><CardContent><Skeleton className="h-8 w-1/2" /><Skeleton className="h-4 w-3/4 mt-1" /></CardContent></Card>)}
                    </div>
                ) : (
                    <div className="grid gap-6 grid-cols-2 lg:grid-cols-5">
                        <StatCard title="Total Distributors" value={stats.totalDistributors} subtext="Active platforms" icon={Building} color="bg-primary" />
                        <StatCard title="Total Users" value={stats.totalUsers} subtext="Across all platforms" icon={Users} color="bg-accent" />
                        <StatCard title="Total Items in Stock" value={stats.totalItemsInStock} subtext="Sum of all stock on platform" icon={Package} color="bg-chart-3" />
                        <StatCard title="Est. Monthly Revenue" value={`€ ${formatPriceForDisplay(stats.monthlyRevenue)}`} subtext="From active subscriptions" icon={DollarSign} color="bg-chart-2" />
                        <StatCard title="Overdue Accounts" value={stats.overdueAccounts.length} subtext="Require payment follow-up" icon={XCircle} color="bg-destructive" />
                    </div>
                )}
                
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
                             <CardDescription>Breakdown of active subscription tiers.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <ChartContainer config={stats.tierChartConfig} className="mx-auto aspect-square h-[250px]">
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

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5"/>Top Distributors</CardTitle>
                        <CardDescription>Top 10 distributors by number of unique records in their inventory.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="overflow-x-auto">
                           {isLoading ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead><Skeleton className="h-5 w-24" /></TableHead><TableHead className="text-right"><Skeleton className="h-5 w-20" /></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {[...Array(5)].map((_, i) => (
                                            <TableRow key={`skeleton-row-${i}`}>
                                                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="h-5 w-12" /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                           ) : (
                               <Table>
                                   <TableHeader><TableRow><TableHead>Distributor Name</TableHead><TableHead className="text-right">Record Count</TableHead></TableRow></TableHeader>
                                   <TableBody>
                                       {stats.topDistributorsByRecords.map(dist => (
                                           <TableRow key={dist.id} className="cursor-pointer" onClick={() => router.push(`/admin/distributors/${dist.id}`)}>
                                               <TableCell className="font-medium">{dist.name}</TableCell>
                                               <TableCell className="text-right">{dist.records}</TableCell>
                                           </TableRow>
                                       ))}
                                   </TableBody>
                               </Table>
                           )}
                       </div>
                    </CardContent>
                </Card>
            </div>
        
    )
}

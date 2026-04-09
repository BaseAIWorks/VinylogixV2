
"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ArrowLeft, DollarSign, Search, FileDown, MoreHorizontal, CheckCircle, XCircle, ShieldCheck } from "lucide-react";
import type { Distributor, User, SubscriptionTier } from "@/types";
import { DistributorTiers } from "@/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getDistributors, updateDistributor } from "@/services/distributor-service";
import { getAllUsers } from "@/services/admin-user-service";
import { getSubscriptionTiers } from "@/services/client-subscription-service";
import { useRouter, useSearchParams } from "next/navigation";
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { formatPriceForDisplay } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const subscriptionStatusColors: Record<string, string> = {
    active: 'text-green-600 bg-green-500/10',
    trialing: 'text-blue-600 bg-blue-500/10',
    past_due: 'text-orange-600 bg-orange-500/10',
    canceled: 'text-red-600 bg-red-500/10',
    cancelled: 'text-red-600 bg-red-500/10',
    incomplete: 'text-yellow-600 bg-yellow-500/10',
};

const tierColors: Record<string, string> = {
    payg: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
    essential: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
    growth: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
    scale: 'bg-primary/20 text-primary border-primary/30',
};

type SubStatusFilter = 'all' | 'active' | 'trialing' | 'past_due' | 'canceled';

export default function AdminAccountsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<SubStatusFilter>((searchParams.get('status') as SubStatusFilter) || 'all');

    const fetchData = useCallback(async () => {
        if (!user || user.role !== 'superadmin') {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [distributorsData, usersData] = await Promise.all([
                getDistributors(),
                getAllUsers(),
            ]);
            setDistributors(distributorsData);
            setAllUsers(usersData);
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

    const accountsData = useMemo(() => {
        const userMap = new Map(allUsers.map(u => [u.uid, u]));
        return distributors.map(d => {
            const masterUser = d.masterUserUid ? userMap.get(d.masterUserUid) : undefined;
            return {
                ...d,
                masterUserEmail: masterUser?.email || 'N/A',
                masterLastLogin: masterUser?.lastLoginAt,
            };
        });
    }, [distributors, allUsers]);

    const filteredAccounts = useMemo(() => {
        let result = accountsData;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(a =>
                a.name.toLowerCase().includes(q) ||
                a.contactEmail.toLowerCase().includes(q) ||
                a.masterUserEmail.toLowerCase().includes(q)
            );
        }

        if (statusFilter !== 'all') {
            result = result.filter(a => {
                const subStatus = a.subscriptionStatus || a.subscription?.status || '';
                return subStatus === statusFilter;
            });
        }

        return result;
    }, [accountsData, searchQuery, statusFilter]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { all: accountsData.length, active: 0, trialing: 0, past_due: 0, canceled: 0 };
        accountsData.forEach(a => {
            const subStatus = a.subscriptionStatus || a.subscription?.status || '';
            if (counts[subStatus] !== undefined) counts[subStatus]++;
        });
        return counts;
    }, [accountsData]);

    const handleChangeTier = async (distributorId: string, newTier: SubscriptionTier) => {
        if (!user) return;
        try {
            await updateDistributor(distributorId, { subscriptionTier: newTier }, user);
            toast({ title: "Tier Updated", description: `Subscription tier changed to ${newTier}. Note: This does not update the Stripe subscription.` });
            fetchData();
        } catch (error) {
            toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
        }
    };

    const handleToggleExempt = async (distributorId: string, currentExempt: boolean) => {
        if (!user) return;
        try {
            await updateDistributor(distributorId, { isSubscriptionExempt: !currentExempt }, user);
            toast({ title: "Updated", description: !currentExempt ? "Marked as managed account." : "Removed managed status." });
            fetchData();
        } catch (error) {
            toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
        }
    };

    const handleExportCSV = () => {
        const headers = ['Distributor', 'Email', 'Tier', 'Status', 'Monthly Price', 'Stripe', 'Last Login', 'Created'];
        const rows = filteredAccounts.map(a => {
            const tier = a.subscriptionTier || a.subscription?.tier || 'N/A';
            const subStatus = a.subscriptionStatus || a.subscription?.status || 'N/A';
            const price = a.subscription?.discountedPrice ?? a.subscription?.price ?? 0;
            const stripe = a.stripeAccountStatus || 'not connected';
            const lastLogin = a.masterLastLogin ? format(new Date(a.masterLastLogin), 'yyyy-MM-dd') : 'Never';
            return [a.name, a.contactEmail, tier, subStatus, price.toFixed(2), stripe, lastLogin, format(new Date(a.createdAt), 'yyyy-MM-dd')].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
        });
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `accounts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (user?.role !== 'superadmin') {
        return <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]"><AlertTriangle className="h-16 w-16 text-destructive mb-4" /><h2 className="text-2xl font-semibold text-destructive">Access Denied</h2><p className="text-muted-foreground mt-2">You must be a Super Admin to view this page.</p><Button onClick={() => router.push('/dashboard')} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard</Button></div>;
    }

    return (
         <div className="space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <DollarSign className="h-5 w-5" />
                        <span>All Accounts</span>
                        <Badge variant="secondary" className="ml-auto text-xs">{distributors.length} total</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                   {/* Search and Filters */}
                   <div className="flex flex-col sm:flex-row gap-3">
                       <div className="relative flex-1">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                           <Input
                               placeholder="Search by name or email..."
                               value={searchQuery}
                               onChange={(e) => setSearchQuery(e.target.value)}
                               className="pl-9"
                           />
                       </div>
                       <div className="flex gap-1.5 flex-wrap">
                           {(['all', 'active', 'trialing', 'past_due', 'canceled'] as const).map(status => (
                               <Button
                                   key={status}
                                   variant={statusFilter === status ? "default" : "outline"}
                                   size="sm"
                                   onClick={() => setStatusFilter(status)}
                                   className="capitalize text-xs"
                               >
                                   {status === 'all' ? 'All' : status.replace('_', ' ')}
                                   <span className="ml-1 text-[10px] opacity-70">({statusCounts[status] || 0})</span>
                               </Button>
                           ))}
                       </div>
                       <Button variant="outline" size="sm" onClick={handleExportCSV} className="shrink-0">
                           <FileDown className="h-4 w-4 mr-1" /> Export
                       </Button>
                   </div>

                   {isLoading ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader><TableRow>{[...Array(7)].map((_, i) => <TableHead key={i}><Skeleton className="h-5 w-20" /></TableHead>)}</TableRow></TableHeader>
                                <TableBody>
                                    {[...Array(5)].map((_, i) => (
                                        <TableRow key={i}>{[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-24" /></TableCell>)}</TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                   ) : filteredAccounts.length > 0 ? (
                       <div className="overflow-x-auto">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Distributor</TableHead>
                                       <TableHead className="hidden sm:table-cell">Master User</TableHead>
                                       <TableHead>Tier</TableHead>
                                       <TableHead>Status</TableHead>
                                       <TableHead className="hidden md:table-cell">Price</TableHead>
                                       <TableHead className="hidden lg:table-cell">Stripe</TableHead>
                                       <TableHead className="hidden xl:table-cell">Last Login</TableHead>
                                       <TableHead className="hidden xl:table-cell">Renewal</TableHead>
                                       <TableHead className="text-right">Actions</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {filteredAccounts.map(account => {
                                       const tier = account.subscriptionTier || account.subscription?.tier || '';
                                       const subStatus = account.subscriptionStatus || account.subscription?.status || '';
                                       const price = account.subscription?.discountedPrice ?? account.subscription?.price ?? 0;
                                       return (
                                       <TableRow key={account.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/distributors/${account.id}`)}>
                                           <TableCell>
                                               <p className="font-medium">{account.name}</p>
                                               <p className="text-xs text-muted-foreground">{account.contactEmail}</p>
                                           </TableCell>
                                           <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{account.masterUserEmail}</TableCell>
                                           <TableCell>
                                                {account.isSubscriptionExempt ?
                                                    <Badge variant="secondary" className="text-[10px]">Managed</Badge> :
                                                    <Badge variant="outline" className={`capitalize text-[10px] ${tierColors[tier] || ''}`}>{tier || 'N/A'}</Badge>
                                                }
                                           </TableCell>
                                           <TableCell>
                                                {account.isSubscriptionExempt ? (
                                                    <span className="text-xs text-muted-foreground">-</span>
                                                ) : (
                                                    <Badge variant="outline" className={`capitalize text-[10px] ${subscriptionStatusColors[subStatus] || ''}`}>
                                                        {subStatus.replace('_', ' ') || 'N/A'}
                                                    </Badge>
                                                )}
                                           </TableCell>
                                           <TableCell className="hidden md:table-cell text-sm">
                                               {tier === 'payg' ? (
                                                   <span className="text-xs text-muted-foreground">6% per order</span>
                                               ) : (
                                                   <span>€ {formatPriceForDisplay(price)}</span>
                                               )}
                                           </TableCell>
                                           <TableCell className="hidden lg:table-cell">
                                               <span className={`inline-block w-2 h-2 rounded-full ${account.stripeAccountStatus === 'verified' ? 'bg-green-500' : account.stripeAccountId ? 'bg-yellow-500' : 'bg-gray-300'}`} title={account.stripeAccountStatus || 'not connected'} />
                                           </TableCell>
                                           <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                                               {account.masterLastLogin ? formatDistanceToNow(new Date(account.masterLastLogin), { addSuffix: true }) : 'Never'}
                                           </TableCell>
                                           <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                                               {account.subscriptionCurrentPeriodEnd ? format(new Date(account.subscriptionCurrentPeriodEnd), 'dd MMM yyyy') : '-'}
                                           </TableCell>
                                           <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                               <DropdownMenu>
                                                   <DropdownMenuTrigger asChild>
                                                       <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                   </DropdownMenuTrigger>
                                                   <DropdownMenuContent align="end">
                                                       <DropdownMenuSub>
                                                           <DropdownMenuSubTrigger>Change Tier</DropdownMenuSubTrigger>
                                                           <DropdownMenuSubContent>
                                                               {DistributorTiers.map(t => (
                                                                   <DropdownMenuItem key={t} onClick={() => handleChangeTier(account.id, t)} className="capitalize" disabled={tier === t}>
                                                                       {tier === t && <CheckCircle className="mr-2 h-3 w-3" />}
                                                                       {t}
                                                                   </DropdownMenuItem>
                                                               ))}
                                                           </DropdownMenuSubContent>
                                                       </DropdownMenuSub>
                                                       <DropdownMenuItem onClick={() => handleToggleExempt(account.id, account.isSubscriptionExempt || false)}>
                                                           <ShieldCheck className="mr-2 h-4 w-4" />
                                                           {account.isSubscriptionExempt ? 'Remove Managed Status' : 'Mark as Managed'}
                                                       </DropdownMenuItem>
                                                       <DropdownMenuSeparator />
                                                       <DropdownMenuItem onClick={() => router.push(`/admin/distributors/${account.id}`)}>
                                                           View Details
                                                       </DropdownMenuItem>
                                                   </DropdownMenuContent>
                                               </DropdownMenu>
                                           </TableCell>
                                       </TableRow>
                                       );
                                   })}
                               </TableBody>
                           </Table>
                       </div>
                   ) : (
                       <div className="text-center py-12 text-muted-foreground">
                            {searchQuery || statusFilter !== 'all' ? (
                                <>
                                    <p className="text-lg">No accounts match your filters.</p>
                                    <Button variant="outline" size="sm" className="mt-2" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}>Clear Filters</Button>
                                </>
                            ) : (
                                <p className="text-lg">No distributors found.</p>
                            )}
                       </div>
                   )}
                   {filteredAccounts.length > 0 && filteredAccounts.length !== accountsData.length && (
                       <p className="text-xs text-muted-foreground text-center">Showing {filteredAccounts.length} of {accountsData.length} accounts</p>
                   )}
                </CardContent>
            </Card>
        </div>
    )
}

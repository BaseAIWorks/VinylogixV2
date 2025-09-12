
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, ArrowLeft, Users, DollarSign } from "lucide-react";
import type { Distributor, User } from "@/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getDistributors } from "@/services/distributor-service";
import { getAllUsers } from "@/services/admin-user-service";
import { useRouter } from "next/navigation";
import { format } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import { formatPriceForDisplay } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const statusColors: Record<Distributor['status'], string> = {
    active: 'bg-green-500/20 text-green-500 border-green-500/30',
    inactive: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
    pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
};

const subscriptionStatusColors: Record<string, string> = {
    active: 'text-green-500',
    trialing: 'text-blue-500',
    past_due: 'text-orange-500',
    cancelled: 'text-red-500',
    incomplete: 'text-yellow-500',
    canceled: 'text-red-500',
};


export default function AdminAccountsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
        return distributors.map(d => ({
            ...d,
            masterUserEmail: d.masterUserUid ? userMap.get(d.masterUserUid)?.email : 'N/A',
        }));
    }, [distributors, allUsers]);


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
                    </CardTitle>
                </CardHeader>
                <CardContent>
                   {isLoading ? (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                                    <TableHead><Skeleton className="h-5 w-32" /></TableHead>
                                    <TableHead><Skeleton className="h-5 w-16" /></TableHead>
                                    <TableHead><Skeleton className="h-5 w-20" /></TableHead>
                                    <TableHead><Skeleton className="h-5 w-20" /></TableHead>
                                    <TableHead><Skeleton className="h-5 w-24" /></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...Array(5)].map((_, i) => (
                                    <TableRow key={`skeleton-row-${i}`}>
                                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                   ) : accountsData.length > 0 ? (
                       <div className="overflow-x-auto">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Distributor</TableHead>
                                       <TableHead className="hidden sm:table-cell">Master User</TableHead>
                                       <TableHead>Tier</TableHead>
                                       <TableHead>Subscription</TableHead>
                                       <TableHead className="hidden md:table-cell">Monthly Price</TableHead>
                                       <TableHead className="hidden lg:table-cell">Created At</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {accountsData.map(account => (
                                       <TableRow key={account.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/distributors/${account.id}`)}>
                                           <TableCell className="font-medium">{account.name}</TableCell>
                                           <TableCell className="hidden sm:table-cell">{account.masterUserEmail}</TableCell>
                                           <TableCell>
                                                {account.isSubscriptionExempt ? 
                                                    <Badge variant="secondary">Managed</Badge> : 
                                                    <Badge variant="outline" className="capitalize">{account.subscription?.tier || 'N/A'}</Badge>
                                                }
                                           </TableCell>
                                           <TableCell>
                                                {account.isSubscriptionExempt ? '-' : (
                                                    <span className={`capitalize font-medium ${subscriptionStatusColors[account.subscription?.status || ''] || ''}`}>
                                                        {account.subscription?.status?.replace('_', ' ') || 'N/A'}
                                                    </span>
                                                )}
                                           </TableCell>
                                           <TableCell className="hidden md:table-cell">€ {formatPriceForDisplay(account.subscription?.discountedPrice ?? account.subscription?.price ?? 0)}</TableCell>
                                           <TableCell className="hidden lg:table-cell">{format(new Date(account.createdAt), 'dd MMM yyyy')}</TableCell>
                                       </TableRow>
                                   ))}
                               </TableBody>
                           </Table>
                       </div>
                   ) : (
                       <div className="text-center py-12 text-muted-foreground">
                            <p className="text-lg">No distributors found.</p>
                       </div>
                   )}
                </CardContent>
            </Card>
        </div>
    )
}

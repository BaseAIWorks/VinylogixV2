

"use client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building, Users, Package, UserCircle, Key, Loader2, BarChart3, AlertTriangle, Trash2, Edit, DollarSign, TrendingUp, Briefcase, KeyRound, Save, Mail, Phone, Home, Link as LinkIcon } from "lucide-react";
import type { Distributor, User, VinylRecord, Order, SubscriptionTier, SubscriptionInfo } from "@/types";
import { SubscriptionTiers } from "@/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getDistributorById, updateDistributor, deleteDistributor } from "@/services/distributor-service";
import { getUsersByDistributorId } from "@/services/user-service";
import { getRecordsByDistributorId } from "@/services/record-service";
import { getOrdersByDistributorId } from "@/services/order-service";
import { getSubscriptionTiers } from "@/services/subscription-service";
import { useParams, useRouter } from "next/navigation";
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { formatPriceForDisplay } from "@/lib/utils";

const StatCard = ({ title, value, subtext, icon: Icon }: { title: string, value: string | number, subtext: string, icon: React.ElementType }) => (
    <Card>
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

const DetailItem = ({ label, value, icon: Icon }: { label: string, value?: string | number | React.ReactNode, icon: React.ElementType }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
        <div className="flex items-start gap-3">
            <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
            <div className="flex flex-col">
                <p className="text-xs text-muted-foreground">{label}</p>
                <div className="text-sm font-medium text-foreground break-words">{value}</div>
            </div>
        </div>
    );
};

export default function DistributorDetailPage() {
    const { user, impersonate } = useAuth();
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const distributorId = typeof params.id === 'string' ? params.id : '';

    const [distributor, setDistributor] = useState<Distributor | null>(null);
    const [associatedUsers, setAssociatedUsers] = useState<User[]>([]);
    const [records, setRecords] = useState<VinylRecord[]>([]);
    const [orders, setOrders] = useState<Order[]>([]);
    const [subscriptionTiers, setSubscriptionTiers] = useState<Record<SubscriptionTier, SubscriptionInfo> | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editFormState, setEditFormState] = useState<Partial<Distributor>>({});
    const [isResetCounterDialogOpen, setIsResetCounterDialogOpen] = useState(false);

    const fetchData = useCallback(async () => {
        if (!user || user.role !== 'superadmin' || !distributorId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [distResult, usersResult, recordsResult, ordersResult, tiersResult] = await Promise.allSettled([
                getDistributorById(distributorId),
                getUsersByDistributorId(distributorId),
                getRecordsByDistributorId(distributorId),
                getOrdersByDistributorId(distributorId),
                getSubscriptionTiers(),
            ]);

            if (distResult.status === 'rejected' || !distResult.value) {
                toast({ title: "Not Found", description: "This distributor could not be found.", variant: "destructive" });
                router.push("/admin/dashboard");
                return;
            }
            const distData = distResult.value;
            setDistributor(distData);
            setEditFormState(distData);

            if (usersResult.status === 'fulfilled') setAssociatedUsers(usersResult.value);
            else console.error("Failed to fetch associated users:", usersResult.reason);
            
            if (recordsResult.status === 'fulfilled') setRecords(recordsResult.value);
            else console.error("Failed to fetch records:", recordsResult.reason);

            if (ordersResult.status === 'fulfilled') setOrders(ordersResult.value);
            else console.error("Failed to fetch orders:", ordersResult.reason);

             if (tiersResult.status === 'fulfilled') setSubscriptionTiers(tiersResult.value);
            else console.error("Failed to fetch subscription tiers:", tiersResult.reason);

        } catch (error) {
            console.error("An unexpected error occurred while fetching distributor details:", error);
            toast({ title: "Error", description: `Could not load data for this distributor.`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, distributorId, toast, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);
    
    const stats = useMemo(() => {
        const operators = associatedUsers.filter(u => u.role === 'worker' || u.role === 'master');
        const clients = associatedUsers.filter(u => u.role === 'viewer');
        const inventoryRecords = records.filter(r => r.isInventoryItem);
        const totalStockValue = inventoryRecords.reduce((sum, r) => sum + ((r.sellingPrice || 0) * ((r.stock_shelves || 0) + (r.stock_storage || 0))), 0);
        const paidOrders = orders.filter(o => o.status === 'paid');
        const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalAmount, 0);

        return {
            recordCount: inventoryRecords.length,
            operatorCount: operators.length,
            clientCount: clients.length,
            totalStockValue: formatPriceForDisplay(totalStockValue),
            totalRevenue: formatPriceForDisplay(totalRevenue),
            totalOrders: orders.length,
        };
    }, [records, associatedUsers, orders]);

    const handleImpersonate = async () => {
        if (!distributor) return;
        await impersonate(distributor.id);
    };
    
    const handleDelete = async () => {
        if (!distributor) return;
        setIsDeleting(true);
        try {
            await deleteDistributor(distributor.id);
            toast({ title: "Distributor Deleted", description: `"${distributor.name}" has been removed.`});
            router.push('/admin/dashboard');
        } catch(error) {
            toast({ title: "Error", description: "Could not delete distributor.", variant: "destructive"});
            setIsDeleting(false);
        }
    }

    const handleUpdateDetails = async () => {
        if (!distributor || !user) return;
        try {
            const { id, createdAt, ...updateData } = editFormState;
            await updateDistributor(distributor.id, updateData, user);
            toast({ title: "Distributor Updated", description: "The distributor details have been saved." });
            setIsEditDialogOpen(false);
            fetchData();
        } catch (error) {
            toast({ title: "Update Failed", description: "Could not save details.", variant: "destructive" });
        }
    };

    const handleResetCounter = async () => {
        if (!distributor || !user) return;
        try {
            await updateDistributor(distributor.id, { orderCounter: 0 }, user);
            toast({ title: "Order Counter Reset", description: "The order counter has been reset to 0." });
            fetchData();
        } catch (error) {
            toast({ title: "Reset Failed", description: "Could not reset the counter.", variant: "destructive" });
        } finally {
            setIsResetCounterDialogOpen(false);
        }
    };
    
    const onEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setEditFormState(prev => ({ ...prev, [id]: value }));
    };
    
    const onSubscriptionTierChange = (tier: SubscriptionTier) => {
        if (!subscriptionTiers) return;
        setEditFormState(prev => ({ ...prev, subscription: subscriptionTiers[tier] }));
    }

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (!distributor) {
         return <div className="text-center p-8"><AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" /><h2 className="text-xl font-semibold">Distributor not found.</h2></div>;
    }


    return (
        <div className="space-y-8">
            <div>
                <Button onClick={() => router.push('/admin/dashboard')} variant="outline" size="sm" className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
                </Button>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3"><Building className="h-8 w-8 text-primary"/>{distributor.name}</h2>
                        <p className="text-muted-foreground">{distributor.contactEmail}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button onClick={handleImpersonate}>
                            <Key className="mr-2 h-4 w-4" /> Enter Distributor Environment
                       </Button>
                       <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeleting}>
                                    <Trash2 className="mr-2 h-4 w-4"/> Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the distributor "{distributor.name}" and all associated data. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Delete'}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                       </AlertDialog>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 grid-cols-2 lg:grid-cols-3">
                <StatCard title="Unique Records" value={stats.recordCount} subtext="Total unique titles in inventory" icon={Package} />
                <StatCard title="Total Orders" value={stats.totalOrders} subtext="All-time orders received" icon={TrendingUp} />
                <StatCard title="Total Revenue" value={`€ ${stats.totalRevenue}`} subtext="From all paid orders" icon={DollarSign} />
                <StatCard title="Operators" value={stats.operatorCount} subtext="Master and worker accounts" icon={UserCircle} />
                <StatCard title="Clients" value={stats.clientCount} subtext="Total client accounts" icon={Users} />
                <StatCard title="Est. Stock Value" value={`€ ${stats.totalStockValue}`} subtext="Based on selling price" icon={BarChart3} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Distributor Details</CardTitle>
                                    <CardDescription>Company and contact information.</CardDescription>
                                </div>
                                <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="icon"><Edit className="h-4 w-4"/></Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-h-[80vh] overflow-y-auto">
                                        <DialogHeader><DialogTitle>Edit Distributor Details</DialogTitle><DialogDescription>Update the information for {distributor.name}.</DialogDescription></DialogHeader>
                                        <div className="grid gap-4 py-4 pr-4">
                                            <div className="space-y-1"><Label htmlFor="name">Distributor Name</Label><Input id="name" value={editFormState.name || ''} onChange={onEditFormChange}/></div>
                                            <div className="space-y-1"><Label htmlFor="slug">URL Slug</Label><Input id="slug" value={editFormState.slug || ''} onChange={onEditFormChange} placeholder="e.g. my-record-store"/></div>
                                            <div className="space-y-1"><Label htmlFor="companyName">Branding Name</Label><Input id="companyName" value={editFormState.companyName || ''} onChange={onEditFormChange} placeholder="e.g. My Record Store"/></div>
                                            <div className="space-y-1"><Label htmlFor="logoUrl">Branding Logo URL</Label><Input id="logoUrl" value={editFormState.logoUrl || ''} onChange={onEditFormChange} placeholder="https://.../logo.png"/></div>
                                            <Separator className="my-2"/>
                                            <div className="space-y-1"><Label htmlFor="contactEmail">Contact Email</Label><Input id="contactEmail" type="email" value={editFormState.contactEmail || ''} onChange={onEditFormChange}/></div>
                                            <div className="space-y-1"><Label htmlFor="phoneNumber">Phone Number</Label><Input id="phoneNumber" value={editFormState.phoneNumber || ''} onChange={onEditFormChange}/></div>
                                            <div className="space-y-1"><Label htmlFor="website">Website</Label><Input id="website" value={editFormState.website || ''} onChange={onEditFormChange} placeholder="https://example.com"/></div>
                                            <Separator className="my-2"/>
                                            <div className="space-y-1"><Label htmlFor="addressLine1">Address Line 1</Label><Input id="addressLine1" value={editFormState.addressLine1 || ''} onChange={onEditFormChange} placeholder="Street, Number"/></div>
                                            <div className="space-y-1"><Label htmlFor="addressLine2">Address Line 2</Label><Input id="addressLine2" value={editFormState.addressLine2 || ''} onChange={onEditFormChange} placeholder="Apartment, suite, etc."/></div>
                                            <div className="space-y-1"><Label htmlFor="chamberOfCommerce">Chamber of Commerce (KVK)</Label><Input id="chamberOfCommerce" value={editFormState.chamberOfCommerce || ''} onChange={onEditFormChange} placeholder="KVK-nummer"/></div>
                                            <div className="space-y-1"><Label htmlFor="vatNumber">VAT Number</Label><Input id="vatNumber" value={editFormState.vatNumber || ''} onChange={onEditFormChange} placeholder="BTW-nummer"/></div>
                                            <Separator className="my-2"/>
                                            <div className="space-y-1"><Label htmlFor="orderIdPrefix">Order ID Prefix</Label><Input id="orderIdPrefix" value={editFormState.orderIdPrefix || ''} onChange={onEditFormChange} placeholder="e.g. ABC" maxLength={4}/></div>
                                            <Separator className="my-2"/>
                                            <div className="flex items-center justify-between rounded-lg border p-4">
                                                <div className="space-y-0.5"><Label className="text-base">Subscription Exempt</Label><p className="text-sm text-muted-foreground">Bypass normal subscription billing.</p></div>
                                                <Switch checked={editFormState.isSubscriptionExempt || false} onCheckedChange={(checked) => setEditFormState(prev => ({...prev, isSubscriptionExempt: checked}))} />
                                            </div>
                                            <div className="space-y-1"><Label htmlFor="subscriptionTier">Subscription Tier</Label>
                                                <Select value={editFormState.subscription?.tier} onValueChange={onSubscriptionTierChange} disabled={editFormState.isSubscriptionExempt}><SelectTrigger id="subscriptionTier"><SelectValue placeholder="Select a tier" /></SelectTrigger><SelectContent>{SubscriptionTiers.map(tier => <SelectItem key={tier} value={tier} className="capitalize">{tier}</SelectItem>)}</SelectContent></Select>
                                            </div>
                                        </div>
                                        <DialogFooter><Button onClick={handleUpdateDetails}><Save className="mr-2 h-4 w-4" />Save Changes</Button></DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                            <DetailItem icon={LinkIcon} label="Public URL Slug" value={distributor.slug} />
                            <DetailItem icon={Mail} label="Contact Email" value={distributor.contactEmail} />
                            <DetailItem icon={Phone} label="Phone Number" value={distributor.phoneNumber} />
                            <DetailItem icon={Home} label="Address" value={<div className="whitespace-pre-wrap">{[distributor.addressLine1, distributor.addressLine2].filter(Boolean).join('\n')}</div>} />
                            <DetailItem icon={Briefcase} label="Chamber of Commerce" value={distributor.chamberOfCommerce} />
                            <DetailItem icon={Briefcase} label="VAT Number" value={distributor.vatNumber} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Associated Users</CardTitle>
                            <CardDescription>All users linked to this distributor.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <Table>
                               <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Last Login</TableHead></TableRow></TableHeader>
                               <TableBody>
                                   {associatedUsers.length > 0 ? (
                                       associatedUsers.map(u => (
                                           <TableRow key={u.uid}><TableCell className="font-medium">{u.email}</TableCell><TableCell><Badge variant={u.role === 'master' ? 'default' : 'secondary'} className="capitalize">{u.role}</Badge></TableCell><TableCell>{u.lastLoginAt ? format(new Date(u.lastLoginAt), 'PPp') : 'Never'}</TableCell></TableRow>
                                       ))
                                   ) : (<TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No users found.</TableCell></TableRow>)}
                               </TableBody>
                           </Table>
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="flex items-center gap-2"><Briefcase className="h-6 w-6 text-primary"/>Subscription</CardTitle>
                                    <CardDescription>Current plan details.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {distributor.isSubscriptionExempt ? (
                                <Badge variant="secondary" className="text-base">Managed Account</Badge>
                            ) : (
                                <>
                                 <DetailItem icon={Briefcase} label="Tier" value={<Badge className="capitalize">{distributor.subscription?.tier || 'N/A'}</Badge>} />
                                 <DetailItem icon={Package} label="Max Records" value={distributor.subscription?.maxRecords === -1 ? 'Unlimited' : distributor.subscription?.maxRecords} />
                                 <DetailItem icon={Users} label="Max Users" value={distributor.subscription?.maxUsers === -1 ? 'Unlimited' : distributor.subscription?.maxUsers} />
                                 <DetailItem icon={DollarSign} label="Orders Enabled" value={distributor.subscription?.allowOrders ? "Yes" : "No"} />
                                 <DetailItem icon={Users} label="AI Features Enabled" value={distributor.subscription?.allowAiFeatures ? "Yes" : "No"} />
                                </>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary"/>Order Number Settings</CardTitle>
                            <CardDescription>Manage order number generation for this distributor.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div>
                                    <p className="font-medium">Next Order Number</p>
                                    <p className="text-sm text-muted-foreground">The next order will be <span className="font-mono text-foreground">{distributor.orderIdPrefix || 'ORD'}-{(distributor.orderCounter || 0) + 1}</span>.</p>
                                </div>
                                <AlertDialog open={isResetCounterDialogOpen} onOpenChange={setIsResetCounterDialogOpen}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline">Reset Counter</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will reset the order counter to 0. The next order will be number 1. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleResetCounter}>Reset</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle>Recent Orders</CardTitle><CardDescription>The 5 most recent orders for this distributor.</CardDescription></CardHeader>
                <CardContent>
                    <Table>
                       <TableHeader><TableRow><TableHead>Order ID</TableHead><TableHead>Client</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                       <TableBody>
                           {orders.length > 0 ? (
                               orders.slice(0,5).map(order => (
                                   <TableRow key={order.id} className="cursor-pointer" onClick={() => router.push(`/orders/${order.id}`)}>
                                       <TableCell className="font-mono text-sm">{order.orderNumber || order.id.slice(0,8)}</TableCell>
                                       <TableCell>{order.viewerEmail}</TableCell>
                                       <TableCell>{format(new Date(order.createdAt), 'dd MMM yyyy')}</TableCell>
                                       <TableCell><Badge variant="outline" className="capitalize">{order.status.replace('_', ' ')}</Badge></TableCell>
                                       <TableCell className="text-right font-medium">€ {formatPriceForDisplay(order.totalAmount)}</TableCell>
                                   </TableRow>
                               ))
                           ) : (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No orders found.</TableCell></TableRow>)}
                       </TableBody>
                    </Table>
                </CardContent>
                {orders.length > 5 && <CardFooter><Button variant="outline" size="sm" onClick={() => router.push('/orders')}>View All Orders</Button></CardFooter>}
            </Card>
        </div>
    );
}

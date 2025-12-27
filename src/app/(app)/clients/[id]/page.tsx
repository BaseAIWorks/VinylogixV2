
"use client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserCircle, ShoppingCart, Library, ListChecks, Loader2, AlertTriangle, Package, Heart, Disc3, Clock, Edit, KeyRound, Mail, Phone, Home, Briefcase, User as UserIcon, CalendarPlus, ShieldCheck, ShieldOff, NotepadText } from "lucide-react";
import type { User, VinylRecord, Order, OrderStatus } from "@/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getUserById } from "@/services/user-service";
import { getRecordsByOwner } from "@/services/record-service";
import { getOrdersByViewerId } from "@/services/order-service";
import { useParams, useRouter } from "next/navigation";
import { format } from 'date-fns';
import { Separator } from "@/components/ui/separator";
import { formatPriceForDisplay } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

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

const statusColors: Record<OrderStatus, string> = {
    pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    awaiting_payment: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    paid: 'bg-green-500/20 text-green-500 border-green-500/30',
    on_hold: 'bg-orange-500/20 text-orange-500 border-orange-500/30',
    cancelled: 'bg-red-500/20 text-red-500 border-red-500/30',
    processing: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    shipped: 'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
};


export default function ClientDetailPage() {
    const { user, updateUserProfile, sendPasswordReset, loading: authLoading, activeDistributorId } = useAuth();
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const clientId = typeof params.id === 'string' ? params.id : '';

    const [client, setClient] = useState<User | null>(null);
    const [clientRecords, setClientRecords] = useState<VinylRecord[]>([]);
    const [clientOrders, setClientOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editFormState, setEditFormState] = useState<Partial<User>>({});
    
    const isClientOnHold = client?.disabledForDistributors?.includes(activeDistributorId || '') || false;

    const fetchData = useCallback(async () => {
        if (!clientId || !user || user.role !== 'master' || !user.distributorId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [clientResult, recordsResult, ordersResult] = await Promise.allSettled([
                getUserById(clientId),
                getRecordsByOwner(clientId, user.distributorId!),
                getOrdersByViewerId(clientId),
            ]);

            if (clientResult.status === 'rejected' || !clientResult.value) {
                toast({ title: "Not Found", description: "This client could not be found.", variant: "destructive" });
                router.push("/clients");
                return;
            }
            setClient(clientResult.value);
            setEditFormState(clientResult.value);


            if (recordsResult.status === 'fulfilled') setClientRecords(recordsResult.value);
            else console.error("Failed to fetch client records:", recordsResult.reason);

            if (ordersResult.status === 'fulfilled') setClientOrders(ordersResult.value);
            else console.error("Failed to fetch client orders:", ordersResult.reason);

        } catch (error) {
            console.error("An unexpected error occurred while fetching client details:", error);
            toast({ title: "Error", description: `Could not load data for this client.`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [clientId, toast, router, user]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchData();
        }
    }, [fetchData, authLoading, user]);

    const handleUpdateClient = async () => {
        if (!client) return;
        const { uid, email, role, ...updateData } = editFormState;
        
        try {
            await updateUserProfile(updateData, client.uid);
            toast({ title: "Client Updated", description: "The client details have been saved."});
            setIsEditDialogOpen(false);
            fetchData(); // Refresh data
        } catch (error) {
            toast({ title: "Update Failed", description: "Could not save client details.", variant: "destructive"});
        }
    };
    
    const handleToggleHoldStatus = async () => {
        if (!client || !activeDistributorId) return;
        
        const currentDisabledList = client.disabledForDistributors || [];
        const newDisabledList = isClientOnHold
            ? currentDisabledList.filter(id => id !== activeDistributorId)
            : [...currentDisabledList, activeDistributorId];

        try {
            await updateUserProfile({ disabledForDistributors: newDisabledList }, client.uid);
            toast({ title: "Access Updated", description: `${client.email}'s access has been ${isClientOnHold ? 'enabled' : 'put on hold'}.`});
            fetchData();
        } catch (error) {
            toast({ title: "Update Failed", description: "Could not update client access status.", variant: "destructive"});
        }
    };
    
    const { collection, wishlist } = useMemo(() => {
        const collection = clientRecords.filter(r => !r.isWishlist);
        const wishlist = clientRecords.filter(r => r.isWishlist);
        return { collection, wishlist };
    }, [clientRecords]);

    const fullAddress = useMemo(() => {
        if (!client) return null;
        const parts = [
            client.addressLine1,
            client.addressLine2,
            `${client.postcode || ''} ${client.city || ''}`.trim(),
            client.country
        ];
        return parts.filter(Boolean).join('\n');
    }, [client]);

    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (user?.role !== 'master') {
        return (
            <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
                <p className="text-muted-foreground mt-2">Only Master users can view client details.</p>
            </div>
        );
    }

    if (!client) {
         return <div className="text-center p-8"><AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" /><h2 className="text-xl font-semibold">Client not found.</h2></div>;
    }


    return (
        <>
            <div className="space-y-8">
                <div>
                    <Button onClick={() => router.push('/clients')} variant="outline" size="sm" className="mb-4">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to All Clients
                    </Button>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3"><UserCircle className="h-8 w-8 text-primary"/>{`${client.firstName || ''} ${client.lastName || ''}`.trim() || 'Client Details'}</h2>
                            <p className="text-muted-foreground">{client.email}</p>
                        </div>
                         <Button onClick={() => setIsEditDialogOpen(true)}>
                            <Edit className="mr-2 h-4 w-4" /> Edit Client
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 grid-cols-2 lg:grid-cols-3">
                    <StatCard title="Collection Size" value={collection.length} subtext="Records in personal collection" icon={Library} />
                    <StatCard title="Wishlist Items" value={wishlist.length} subtext="Records on wishlist" icon={ListChecks} />
                    <StatCard title="Total Orders" value={clientOrders.length} subtext="All-time orders placed" icon={ShoppingCart} />
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>Client Details</CardTitle></CardHeader>
                        <CardContent className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
                            <DetailItem icon={Mail} label="Email" value={client.email} />
                            <DetailItem icon={Phone} label="Phone" value={client.phoneNumber} />
                             <DetailItem icon={Phone} label="Mobile" value={client.mobileNumber} />
                            <DetailItem icon={Briefcase} label="Company" value={client.companyName} />
                            <DetailItem icon={Home} label="Address" value={<div className="whitespace-pre-wrap">{fullAddress}</div>} />
                            <DetailItem icon={Briefcase} label="Chamber of Commerce" value={client.chamberOfCommerce} />
                             <DetailItem icon={Briefcase} label="EORI Number" value={client.eoriNumber} />
                            <DetailItem icon={UserIcon} label="VAT Number" value={client.vatNumber} />
                            {client.createdAt && <DetailItem icon={CalendarPlus} label="Client Since" value={format(new Date(client.createdAt), 'dd MMM yyyy')} />}
                            {client.notes && <DetailItem icon={NotepadText} label="Notes" value={<div className="whitespace-pre-wrap">{client.notes}</div>} />}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary"/>Access Control</CardTitle></CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5">
                                    <Label htmlFor="on-hold-switch" className="text-base font-medium">
                                        Client On Hold
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        {isClientOnHold 
                                            ? "Access to your catalog is currently suspended." 
                                            : "Client has active access to your catalog."
                                        }
                                    </p>
                                </div>
                                <Switch
                                    id="on-hold-switch"
                                    checked={!isClientOnHold}
                                    onCheckedChange={handleToggleHoldStatus}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="collection" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="collection">Collection</TabsTrigger>
                        <TabsTrigger value="wishlist">Wishlist</TabsTrigger>
                        <TabsTrigger value="orders">Order History</TabsTrigger>
                    </TabsList>
                    <TabsContent value="collection">
                         <Card><CardContent className="p-4"><RecordTable records={collection} /></CardContent></Card>
                    </TabsContent>
                     <TabsContent value="wishlist">
                         <Card><CardContent className="p-4"><RecordTable records={wishlist} /></CardContent></Card>
                    </TabsContent>
                     <TabsContent value="orders">
                         <Card><CardContent className="p-4"><OrderTable orders={clientOrders} /></CardContent></Card>
                    </TabsContent>
                </Tabs>
            </div>
             <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Edit Client: {client.email}</DialogTitle><DialogDescription>Update the details for this client.</DialogDescription></DialogHeader>
                    <div className="grid gap-4 py-4 pr-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label htmlFor="firstName">First Name</Label><Input id="firstName" value={editFormState.firstName || ''} onChange={(e) => setEditFormState(p => ({...p, firstName: e.target.value}))}/></div>
                            <div><Label htmlFor="lastName">Last Name</Label><Input id="lastName" value={editFormState.lastName || ''} onChange={(e) => setEditFormState(p => ({...p, lastName: e.target.value}))}/></div>
                        </div>
                        <div><Label htmlFor="companyName">Company Name</Label><Input id="companyName" value={editFormState.companyName || ''} onChange={(e) => setEditFormState(p => ({...p, companyName: e.target.value}))}/></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label htmlFor="phoneNumber">Phone Number</Label><Input id="phoneNumber" value={editFormState.phoneNumber || ''} onChange={(e) => setEditFormState(p => ({...p, phoneNumber: e.target.value}))}/></div>
                            <div><Label htmlFor="mobileNumber">Mobile Number</Label><Input id="mobileNumber" value={editFormState.mobileNumber || ''} onChange={(e) => setEditFormState(p => ({...p, mobileNumber: e.target.value}))}/></div>
                        </div>
                        <Separator className="my-2"/>
                        <h4 className="font-semibold">Address</h4>
                        <div><Label htmlFor="addressLine1">Address Line 1</Label><Input id="addressLine1" value={editFormState.addressLine1 || ''} onChange={(e) => setEditFormState(p => ({...p, addressLine1: e.target.value}))}/></div>
                        <div><Label htmlFor="addressLine2">Address Line 2</Label><Input id="addressLine2" value={editFormState.addressLine2 || ''} onChange={(e) => setEditFormState(p => ({...p, addressLine2: e.target.value}))}/></div>
                        <div className="grid grid-cols-2 gap-4">
                           <div><Label htmlFor="postcode">Postcode</Label><Input id="postcode" value={editFormState.postcode || ''} onChange={(e) => setEditFormState(p => ({...p, postcode: e.target.value}))}/></div>
                           <div><Label htmlFor="city">City</Label><Input id="city" value={editFormState.city || ''} onChange={(e) => setEditFormState(p => ({...p, city: e.target.value}))}/></div>
                        </div>
                         <div><Label htmlFor="country">Country</Label><Input id="country" value={editFormState.country || ''} onChange={(e) => setEditFormState(p => ({...p, country: e.target.value}))}/></div>
                         <Separator className="my-2"/>
                         <h4 className="font-semibold">Business Details</h4>
                         <div><Label htmlFor="chamberOfCommerce">Chamber of Commerce</Label><Input id="chamberOfCommerce" value={editFormState.chamberOfCommerce || ''} onChange={(e) => setEditFormState(p => ({...p, chamberOfCommerce: e.target.value}))}/></div>
                         <div><Label htmlFor="eoriNumber">EORI Number</Label><Input id="eoriNumber" value={editFormState.eoriNumber || ''} onChange={(e) => setEditFormState(p => ({...p, eoriNumber: e.target.value}))}/></div>
                         <div><Label htmlFor="vatNumber">VAT Number</Label><Input id="vatNumber" value={editFormState.vatNumber || ''} onChange={(e) => setEditFormState(p => ({...p, vatNumber: e.target.value}))}/></div>
                         <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={editFormState.notes || ''} onChange={(e) => setEditFormState(p => ({...p, notes: e.target.value}))}/></div>

                         <Separator className="my-2"/>
                        <div className="space-y-2 rounded-lg border border-yellow-500/50 p-4 bg-yellow-500/10">
                             <Label>Reset Password</Label>
                             <p className="text-xs text-muted-foreground">To reset the password, click the button below. An email will be sent to the client with instructions.</p>
                             <Button type="button" variant="outline" size="sm" onClick={() => client.email && sendPasswordReset(client.email)}>
                                <KeyRound className="mr-2 h-4 w-4"/>Send Password Reset
                             </Button>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleUpdateClient}>Save Changes</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

const RecordTable = ({ records }: { records: VinylRecord[] }) => {
    const router = useRouter();
    if (records.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">No records to display.</div>
    }
    return (
        <Table>
           <TableHeader><TableRow><TableHead>Record</TableHead><TableHead className="hidden md:table-cell">Year</TableHead><TableHead className="hidden md:table-cell">Added</TableHead></TableRow></TableHeader>
           <TableBody>
               {records.map(record => (
                   <TableRow key={record.id} className="cursor-pointer" onClick={() => router.push(`/records/${record.id}`)}>
                       <TableCell className="flex items-center gap-4">
                           <Image src={record.cover_url || 'https://placehold.co/64x64.png'} alt={record.title} width={48} height={48} className="rounded-md aspect-square object-cover" data-ai-hint="album cover" unoptimized={record.cover_url?.includes('discogs.com')} />
                           <div>
                               <p className="font-semibold">{record.title}</p>
                               <p className="text-sm text-muted-foreground">{record.artist}</p>
                           </div>
                       </TableCell>
                       <TableCell className="hidden md:table-cell">{record.year || '-'}</TableCell>
                       <TableCell className="hidden md:table-cell">{format(new Date(record.added_at), 'dd MMM yyyy')}</TableCell>
                   </TableRow>
               ))}
           </TableBody>
        </Table>
    );
};

const OrderTable = ({ orders }: { orders: Order[] }) => {
     const router = useRouter();
    if (orders.length === 0) {
        return <div className="text-center py-10 text-muted-foreground">No orders found.</div>
    }
    return (
       <Table>
           <TableHeader><TableRow><TableHead>Order #</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
           <TableBody>
               {orders.map(order => (
                   <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/orders/${order.id}`)}>
                       <TableCell className="font-mono text-sm">{order.orderNumber || order.id.slice(0, 8)}</TableCell>
                       <TableCell>{format(new Date(order.createdAt), 'dd MMM yyyy')}</TableCell>
                       <TableCell><Badge variant="outline" className={`capitalize ${statusColors[order.status]}`}>{order.status.replace('_', ' ')}</Badge></TableCell>
                       <TableCell className="text-right font-medium">€ {formatPriceForDisplay(order.totalAmount)}</TableCell>
                   </TableRow>
               ))}
           </TableBody>
       </Table>
    );
};

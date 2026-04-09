
"use client";
import ProtectedRoute from "@/components/layout/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, PlusCircle, Loader2, AlertTriangle, ArrowLeft, MoreHorizontal, Trash2, CheckCircle, XCircle, Hourglass, Clock, Search, ArrowUpDown, CreditCard, Eye, EyeOff } from "lucide-react";
import type { Distributor, SubscriptionInfo, SubscriptionTier } from "@/types";
import { DistributorTiers } from "@/types";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getDistributors, addDistributor, updateDistributor, deleteDistributor } from "@/services/distributor-service";
import { getSubscriptionTiers } from "@/services/client-subscription-service";
import { useRouter } from "next/navigation";
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type SortField = 'name' | 'status' | 'tier' | 'createdAt';
type SortDirection = 'asc' | 'desc';

export default function AdminDashboardPage() {
    const { user, addUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [subscriptionTiers, setSubscriptionTiers] = useState<Record<SubscriptionTier, SubscriptionInfo> | null>(null);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | Distributor['status']>("all");
    const [sortField, setSortField] = useState<SortField>('createdAt');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // State for Add Dialog
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState("");
    const [newMasterUserFirstName, setNewMasterUserFirstName] = useState("");
    const [newMasterUserLastName, setNewMasterUserLastName] = useState("");
    const [newMasterUserEmail, setNewMasterUserEmail] = useState("");
    const [newMasterUserPassword, setNewMasterUserPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [newDistributorTier, setNewDistributorTier] = useState<SubscriptionTier>('growth');

    // State for Delete Dialog
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [distributorToDelete, setDistributorToDelete] = useState<Distributor | null>(null);

    const fetchInitialData = useCallback(async () => {
        if (!user || user.role !== 'superadmin') {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [distributorsData, tiersData] = await Promise.all([
                getDistributors(),
                getSubscriptionTiers()
            ]);
            setDistributors(distributorsData);
            setSubscriptionTiers(tiersData);
        } catch (error) {
            const errorMessage = (error as Error).message || "An unknown error occurred.";
            toast({ title: "Error", description: `Could not fetch initial data. ${errorMessage}`, variant: "destructive", duration: 7000 });
        } finally {
            setIsLoading(false);
        }
    }, [toast, user]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchInitialData();
        }
    }, [user, authLoading, fetchInitialData]);

    // Filtered and sorted distributors
    const filteredDistributors = useMemo(() => {
        let result = distributors;

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(d =>
                d.name.toLowerCase().includes(q) ||
                d.contactEmail.toLowerCase().includes(q) ||
                (d.subscriptionTier || d.subscription?.tier || '').toLowerCase().includes(q)
            );
        }

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter(d => d.status === statusFilter);
        }

        // Sort
        result = [...result].sort((a, b) => {
            let cmp = 0;
            switch (sortField) {
                case 'name': cmp = a.name.localeCompare(b.name); break;
                case 'status': cmp = a.status.localeCompare(b.status); break;
                case 'tier': cmp = (a.subscriptionTier || '').localeCompare(b.subscriptionTier || ''); break;
                case 'createdAt': cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
            }
            return sortDirection === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [distributors, searchQuery, statusFilter, sortField, sortDirection]);

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { all: distributors.length, active: 0, inactive: 0, pending: 0, awaiting_approval: 0 };
        distributors.forEach(d => { if (counts[d.status] !== undefined) counts[d.status]++; });
        return counts;
    }, [distributors]);

    const handleAddDialogOpening = (open: boolean) => {
        if (open) {
            setNewCompanyName("");
            setNewMasterUserFirstName("");
            setNewMasterUserLastName("");
            setNewMasterUserEmail("");
            setNewMasterUserPassword("");
            setShowPassword(false);
            setNewDistributorTier("growth");
        }
        setIsAddDialogOpen(open);
    };

    const handleAddDistributor = async () => {
        if (!newCompanyName || !newMasterUserFirstName || !newMasterUserLastName || !newMasterUserEmail || !newMasterUserPassword) {
            toast({ title: "Validation Error", description: "All fields are required to create a new distributor.", variant: "destructive"});
            return;
        }
         if (newMasterUserPassword.length < 6) {
            toast({ title: "Validation Error", description: "Password must be at least 6 characters long.", variant: "destructive"});
            return;
        }
        if (!user || !subscriptionTiers) {
            toast({ title: "Error", description: "Authentication or configuration data is missing.", variant: "destructive"});
            return;
        }

        let newDistributorId: string | null = null;
        try {
            const subscription = subscriptionTiers[newDistributorTier];
            const newDistributor = await addDistributor({
                name: newCompanyName,
                companyName: newCompanyName,
                contactEmail: newMasterUserEmail,
                status: 'pending',
                subscription: subscription,
                subscriptionTier: newDistributorTier,
            }, user);
            newDistributorId = newDistributor.id;

            const newMasterUid = await addUser(
                newMasterUserEmail,
                newMasterUserPassword,
                'master',
                newDistributorId,
                { firstName: newMasterUserFirstName, lastName: newMasterUserLastName }
            );

            if (!newMasterUid) {
                throw new Error("Failed to get UID for the new master user.");
            }

            await updateDistributor(newDistributorId, { masterUserUid: newMasterUid }, user);

            toast({
                title: "Setup Complete",
                description: `Distributor "${newDistributor.name}" and Master User have been created.`,
                duration: 7000
            });

            handleAddDialogOpening(false);
            fetchInitialData();

        } catch (error) {
             const errorMessage = (error as Error).message || "An unknown error occurred.";
             const finalDescription = `Failed to create distributor: ${errorMessage}. The partially created distributor has been automatically rolled back. Please check your user permissions and try again`;

             if (newDistributorId) {
                 console.error(`Attempting to roll back creation of distributor ID: ${newDistributorId}`);
                 await deleteDistributor(newDistributorId);
             }

             toast({
                 title: "Distributor Creation Failed",
                 description: finalDescription,
                 variant: "destructive",
                 duration: 15000
             });
        }
    };

    const handleStatusUpdate = async (distributorId: string, newStatus: Distributor['status']) => {
        if (!user) return;
        try {
            await updateDistributor(distributorId, { status: newStatus }, user);
            toast({ title: "Status Updated", description: "The distributor's status has been changed." });
            fetchInitialData();
        } catch (error) {
            const errorMessage = (error as Error).message || "Please check the console for details.";
            toast({ title: "Error", description: `Failed to update status. ${errorMessage}`, variant: "destructive" });
        }
    };

    const handleDeleteDistributor = async () => {
        if (!distributorToDelete) return;
        try {
            await deleteDistributor(distributorToDelete.id);
            toast({ title: "Distributor Deleted", description: `"${distributorToDelete.name}" has been deleted.` });
        } catch (error) {
            const errorMessage = (error as Error).message || "Please check the console for details.";
            toast({ title: "Error", description: `Failed to delete distributor. ${errorMessage}`, variant: "destructive" });
        } finally {
            setDistributorToDelete(null);
            setIsDeleteDialogOpen(false);
            fetchInitialData();
        }
    };

    const statusColors: Record<Distributor['status'], string> = {
        active: 'bg-green-500/20 text-green-500 border-green-500/30',
        inactive: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
        awaiting_approval: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
        pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    };

    const tierColors: Record<string, string> = {
        payg: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
        essential: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
        growth: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
        scale: 'bg-primary/20 text-primary border-primary/30',
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

    const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
        <TableHead className={`cursor-pointer select-none hover:text-foreground ${className || ''}`} onClick={() => toggleSort(field)}>
            <div className="flex items-center gap-1">
                {children}
                <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
            </div>
        </TableHead>
    );

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div/>
                     <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpening}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-5 w-5" />
                                Add New Distributor
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Distributor</DialogTitle>
                                <DialogDescription>
                                    Create a new environment and master user account for a distributor.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="company-name" className="text-right">Company Name</Label>
                                    <Input id="company-name" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} className="col-span-3" placeholder="Name of the company" />
                                </div>
                                 <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="first-name" className="text-right">First Name</Label>
                                    <Input id="first-name" value={newMasterUserFirstName} onChange={(e) => setNewMasterUserFirstName(e.target.value)} className="col-span-3" placeholder="Master user's first name" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="last-name" className="text-right">Last Name</Label>
                                    <Input id="last-name" value={newMasterUserLastName} onChange={(e) => setNewMasterUserLastName(e.target.value)} className="col-span-3" placeholder="Master user's last name" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="master-email" className="text-right">Email</Label>
                                    <Input id="master-email" type="email" value={newMasterUserEmail} onChange={(e) => setNewMasterUserEmail(e.target.value)} className="col-span-3" placeholder="Email for login and contact" autoComplete="off" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="master-password" className="text-right">Password</Label>
                                    <div className="col-span-3 relative">
                                        <Input id="master-password" type={showPassword ? "text" : "password"} value={newMasterUserPassword} onChange={(e) => setNewMasterUserPassword(e.target.value)} placeholder="Temporary password (min 6 chars)" autoComplete="new-password" className="pr-10" />
                                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                                            {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                                        </Button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="subscription-tier" className="text-right">Subscription</Label>
                                    <Select value={newDistributorTier} onValueChange={(v) => setNewDistributorTier(v as SubscriptionTier)}>
                                        <SelectTrigger id="subscription-tier" className="col-span-3">
                                            <SelectValue placeholder="Select a tier" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DistributorTiers.map(tier => (
                                                <SelectItem key={tier} value={tier} className="capitalize">{tier}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" onClick={handleAddDistributor}>Add Distributor</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3">
                            <Building className="h-5 w-5" />
                            <span>All Distributors</span>
                            <Badge variant="secondary" className="ml-auto text-xs">{distributors.length} total</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       {/* Search and Filter */}
                       <div className="flex flex-col sm:flex-row gap-3">
                           <div className="relative flex-1">
                               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                               <Input
                                   placeholder="Search by name, email, or tier..."
                                   value={searchQuery}
                                   onChange={(e) => setSearchQuery(e.target.value)}
                                   className="pl-9"
                               />
                           </div>
                           <div className="flex gap-1.5 flex-wrap">
                               {(['all', 'active', 'inactive', 'pending', 'awaiting_approval'] as const).map(status => (
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
                       </div>

                       {filteredDistributors.length > 0 ? (
                           <div className="overflow-x-auto">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableHeader field="name">Name</SortableHeader>
                                        <TableHead className="hidden sm:table-cell">Email</TableHead>
                                        <SortableHeader field="tier" className="hidden lg:table-cell">Tier</SortableHeader>
                                        <SortableHeader field="status">Status</SortableHeader>
                                        <TableHead className="hidden xl:table-cell">Payment</TableHead>
                                        <SortableHeader field="createdAt" className="hidden md:table-cell">Created</SortableHeader>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDistributors.map(distributor => {
                                        const tier = distributor.subscriptionTier || distributor.subscription?.tier;
                                        const stripeOk = distributor.stripeAccountStatus === 'verified';
                                        const paypalOk = distributor.paypalAccountStatus === 'verified';
                                        return (
                                        <TableRow key={distributor.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/distributors/${distributor.id}`)}>
                                            <TableCell>
                                                <p className="font-medium">{distributor.name}</p>
                                                {distributor.isSubscriptionExempt && <Badge variant="secondary" className="text-[10px] mt-0.5">Managed</Badge>}
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{distributor.contactEmail}</TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                {tier && (
                                                    <Badge variant="outline" className={`capitalize text-[10px] ${tierColors[tier] || ''}`}>
                                                        {tier}
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`capitalize text-[10px] ${statusColors[distributor.status]}`}>
                                                    {distributor.status.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden xl:table-cell">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`inline-block w-2 h-2 rounded-full ${stripeOk ? 'bg-green-500' : distributor.stripeAccountId ? 'bg-yellow-500' : 'bg-gray-300'}`} title={`Stripe: ${distributor.stripeAccountStatus || 'not connected'}`} />
                                                    <span className="text-[10px] text-muted-foreground">S</span>
                                                    <span className={`inline-block w-2 h-2 rounded-full ${paypalOk ? 'bg-green-500' : distributor.paypalMerchantId ? 'bg-yellow-500' : 'bg-gray-300'}`} title={`PayPal: ${distributor.paypalAccountStatus || 'not connected'}`} />
                                                    <span className="text-[10px] text-muted-foreground">P</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{format(new Date(distributor.createdAt), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenuItem onClick={() => handleStatusUpdate(distributor.id, 'active')}>
                                                            <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Set Active
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleStatusUpdate(distributor.id, 'inactive')}>
                                                            <XCircle className="mr-2 h-4 w-4 text-gray-500" /> Set Inactive
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleStatusUpdate(distributor.id, 'pending')}>
                                                            <Hourglass className="mr-2 h-4 w-4 text-yellow-500" /> Set Pending
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleStatusUpdate(distributor.id, 'awaiting_approval')}>
                                                            <Clock className="mr-2 h-4 w-4 text-amber-500" /> Set Awaiting Approval
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem className="text-destructive" onClick={() => { setDistributorToDelete(distributor); setIsDeleteDialogOpen(true); }}>
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
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
                                        <p className="text-lg">No distributors match your filters.</p>
                                        <Button variant="outline" size="sm" className="mt-2" onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}>Clear Filters</Button>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-lg">No distributors found.</p>
                                        <p className="text-sm">Click "Add New Distributor" to get started.</p>
                                    </>
                                )}
                           </div>
                       )}
                       {filteredDistributors.length > 0 && filteredDistributors.length !== distributors.length && (
                           <p className="text-xs text-muted-foreground text-center">Showing {filteredDistributors.length} of {distributors.length} distributors</p>
                       )}
                    </CardContent>
                </Card>
            </div>
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the distributor "{distributorToDelete?.name}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDistributorToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteDistributor} className="bg-destructive hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

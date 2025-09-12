
"use client";
import ProtectedRoute from "@/components/layout/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building, PlusCircle, Loader2, AlertTriangle, ArrowLeft, MoreHorizontal, Trash2, CheckCircle, XCircle, Hourglass } from "lucide-react";
import type { Distributor, SubscriptionInfo, SubscriptionTier } from "@/types";
import { SubscriptionTiers } from "@/types";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getDistributors, addDistributor, updateDistributor, deleteDistributor } from "@/services/distributor-service";
import { getSubscriptionTiers } from "@/services/subscription-service";
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


export default function AdminDashboardPage() {
    const { user, addUser, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [distributors, setDistributors] = useState<Distributor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [subscriptionTiers, setSubscriptionTiers] = useState<Record<SubscriptionTier, SubscriptionInfo> | null>(null);


    // State for Add Dialog
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState("");
    const [newMasterUserFirstName, setNewMasterUserFirstName] = useState("");
    const [newMasterUserLastName, setNewMasterUserLastName] = useState("");
    const [newMasterUserEmail, setNewMasterUserEmail] = useState("");
    const [newMasterUserPassword, setNewMasterUserPassword] = useState("");
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

    const handleAddDialogOpening = (open: boolean) => {
        if (open) {
            // Reset state when dialog opens
            setNewCompanyName("");
            setNewMasterUserFirstName("");
            setNewMasterUserLastName("");
            setNewMasterUserEmail("");
            setNewMasterUserPassword("");
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
            // Step 1: Create the Distributor document to get an ID.
            const newDistributor = await addDistributor({ 
                name: newCompanyName, 
                companyName: newCompanyName, // Set branding name on creation
                contactEmail: newMasterUserEmail, 
                status: 'pending',
                subscription: subscription,
            }, user);
            newDistributorId = newDistributor.id;

            // Step 2: Create the Master User associated with this new distributor ID.
            const newMasterUid = await addUser(
                newMasterUserEmail, 
                newMasterUserPassword, 
                'master', 
                newDistributorId, 
                { firstName: newMasterUserFirstName, lastName: newMasterUserLastName } // Pass details
            );
            
            if (!newMasterUid) {
                throw new Error("Failed to get UID for the new master user.");
            }
            
            // Step 3: Update distributor with the master user's UID for permission linking.
            await updateDistributor(newDistributorId, { masterUserUid: newMasterUid }, user);

            toast({ 
                title: "Setup Complete", 
                description: `Distributor "${newDistributor.name}" and Master User have been created.`,
                duration: 7000 
            });

            // Reset form and state on success
            handleAddDialogOpening(false);
            fetchInitialData();
            
        } catch (error) {
             const errorMessage = (error as Error).message || "An unknown error occurred.";
             const finalDescription = `Failed to create distributor: ${errorMessage}. The partially created distributor has been automatically rolled back. Please check your user permissions and try again`;
             
             if (newDistributorId) {
                 console.log(`Attempting to roll back creation of distributor ID: ${newDistributorId}`);
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
            fetchInitialData(); // Re-fetch to update the UI
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
        pending: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
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
                                    <Input id="master-password" type="password" value={newMasterUserPassword} onChange={(e) => setNewMasterUserPassword(e.target.value)} className="col-span-3" placeholder="Temporary password" autoComplete="new-password" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="subscription-tier" className="text-right">Subscription</Label>
                                    <Select value={newDistributorTier} onValueChange={(v) => setNewDistributorTier(v as SubscriptionTier)}>
                                        <SelectTrigger id="subscription-tier" className="col-span-3">
                                            <SelectValue placeholder="Select a tier" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SubscriptionTiers.map(tier => (
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
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                       {distributors.length > 0 ? (
                           <div className="overflow-x-auto">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Distributor Name</TableHead>
                                        <TableHead className="hidden sm:table-cell">Contact Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="hidden md:table-cell">Created At</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {distributors.map(distributor => (
                                        <TableRow key={distributor.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/distributors/${distributor.id}`)}>
                                            <TableCell className="font-medium">{distributor.name}</TableCell>
                                            <TableCell className="hidden sm:table-cell">{distributor.contactEmail}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`capitalize ${statusColors[distributor.status]}`}>
                                                    {distributor.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">{format(new Date(distributor.createdAt), 'dd MMM yyyy')}</TableCell>
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
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem className="text-destructive" onClick={() => { setDistributorToDelete(distributor); setIsDeleteDialogOpen(true); }}>
                                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                </Table>
                           </div>
                       ) : (
                           <div className="text-center py-12 text-muted-foreground">
                                <p className="text-lg">No distributors found.</p>
                                <p className="text-sm">Click "Add New Distributor" to get started.</p>
                           </div>
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

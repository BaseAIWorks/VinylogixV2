
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, HardHat, AlertTriangle, PlusCircle, MoreVertical, Edit, Trash2, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getUsersByDistributorId } from "@/services/user-service";


export default function OperatorsPage() {
    const { user, loading: authLoading, addUser, deleteUser } = useAuth();
    
    // --- PLAATS DEZE CONSOLE.LOG HIER ---
    console.log(`OperatorsPage: Component rendered. Auth loading: ${authLoading}, User:`, user);
    // ------------------------------------
    
    const router = useRouter();
    const { toast } = useToast();

    const [operators, setOperators] = useState<User[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isAddingOperator, setIsAddingOperator] = useState(false);
    
    const [newOperatorEmail, setNewOperatorEmail] = useState("");
    const [newOperatorPassword, setNewOperatorPassword] = useState("");
    const [newOperatorFirstName, setNewOperatorFirstName] = useState("");
    const [newOperatorLastName, setNewOperatorLastName] = useState("");

    const [operatorToDelete, setOperatorToDelete] = useState<User | null>(null);


    const fetchOperators = useCallback(async () => {
        if (!user || user.role !== 'master' || !user.distributorId) {
            setIsLoadingData(false);
            console.log(`fetchOperators: User not master or missing distributorId. User role: ${user?.role}, Distributor ID: ${user?.distributorId}`);
            return;
        }
        console.log(`fetchOperators: Calling getUsersByDistributorId with user role: ${user.role} and distributorId: ${user.distributorId}`);
        setIsLoadingData(true);
        try {
            const fetchedOperators = await getUsersByDistributorId(user.distributorId);
            setOperators(fetchedOperators);
        } catch (error) {
            toast({ title: "Error", description: "Could not fetch operators.", variant: "destructive" });
            console.error("fetchOperators: Error during data fetch:", error);
        } finally {
            setIsLoadingData(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchOperators();
        }
    }, [user, authLoading, fetchOperators]);


    const formatDateSafe = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return format(parseISO(dateString), 'dd MMM yyyy, HH:mm');
        } catch (e) {
            return 'Invalid Date';
        }
    };

    const handleAddDialogOpening = (open: boolean) => {
        if (open) {
            // Reset state when dialog opens
            setNewOperatorEmail("");
            setNewOperatorPassword("");
            setNewOperatorFirstName("");
            setNewOperatorLastName("");
        }
        setIsAddDialogOpen(open);
    };
    
    const handleAddOperator = async () => {
        if (!newOperatorEmail.includes('@') || !newOperatorPassword) {
            toast({ title: "Invalid Input", description: "Please enter a valid email and a temporary password.", variant: "destructive" });
            return;
        }
        setIsAddingOperator(true);
        try {
            await addUser(newOperatorEmail, newOperatorPassword, 'worker', undefined, {
                firstName: newOperatorFirstName,
                lastName: newOperatorLastName
            });
            handleAddDialogOpening(false);
            toast({ title: "Operator Added", description: `An account has been created for ${newOperatorEmail}.` });
            fetchOperators(); // Re-fetch the list
        } catch (error) {
            toast({ title: "Failed to Add Operator", description: (error as Error).message, variant: "destructive" });
        }
        setIsAddingOperator(false);
    };

    const handleDeleteOperator = async () => {
        if (!operatorToDelete) return;
        try {
            const success = await deleteUser(operatorToDelete.uid);
            if (success) {
                toast({ title: "Operator Deleted", description: `"${operatorToDelete.email}" has been deleted.` });
                fetchOperators();
            }
        } catch (error) {
            // Error is already handled inside the deleteUser function in useAuth
        } finally {
            setOperatorToDelete(null);
        }
    };

    if (authLoading || isLoadingData) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    if (user?.role !== 'master') {
         return (
            <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
                <p className="text-muted-foreground mt-2">Only Master users can view this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
             <Card className="shadow-lg">
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <HardHat className="h-6 w-6 text-primary" />
                        <CardTitle>Your Operators</CardTitle>
                    </div>
                     <Dialog open={isAddDialogOpen} onOpenChange={handleAddDialogOpening}>
                        <DialogTrigger asChild>
                             <Button className="w-full md:w-auto">
                                <PlusCircle className="mr-2 h-5 w-5" />
                                Add New Operator
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add New Operator</DialogTitle>
                                <DialogDescription>
                                    Create a new account for a worker in your organization. They will be able to manage inventory and orders.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                               <div className="space-y-2"><Label htmlFor="newOperatorEmail">Operator Email *</Label><Input id="newOperatorEmail" type="email" placeholder="operator@example.com" value={newOperatorEmail} onChange={(e) => setNewOperatorEmail(e.target.value)} disabled={isAddingOperator} autoComplete="off" /></div>
                               <div className="space-y-2"><Label htmlFor="newOperatorPassword">Temporary Password *</Label><Input id="newOperatorPassword" type="password" placeholder="Min. 6 characters" value={newOperatorPassword} onChange={(e) => setNewOperatorPassword(e.target.value)} disabled={isAddingOperator} autoComplete="new-password" /></div>
                               <div className="grid grid-cols-2 gap-4">
                                 <div className="space-y-2"><Label htmlFor="newOperatorFirstName">First Name</Label><Input id="newOperatorFirstName" value={newOperatorFirstName} onChange={e => setNewOperatorFirstName(e.target.value)} disabled={isAddingOperator} /></div>
                                 <div className="space-y-2"><Label htmlFor="newOperatorLastName">Last Name</Label><Input id="newOperatorLastName" value={newOperatorLastName} onChange={e => setNewOperatorLastName(e.target.value)} disabled={isAddingOperator} /></div>
                               </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="ghost">Cancel</Button>
                                </DialogClose>
                                <Button type="button" onClick={handleAddOperator} disabled={isAddingOperator || !newOperatorEmail || !newOperatorPassword}>
                                    {isAddingOperator && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Add Operator
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                   {operators.length > 0 ? (
                       <div className="overflow-x-auto">
                           <Table>
                               <TableHeader>
                                   <TableRow>
                                       <TableHead>Name</TableHead>
                                       <TableHead>Email</TableHead>
                                       <TableHead className="hidden md:table-cell">Role</TableHead>
                                       <TableHead className="hidden sm:table-cell">Last Login</TableHead>
                                       <TableHead className="text-right">Actions</TableHead>
                                   </TableRow>
                               </TableHeader>
                               <TableBody>
                                   {operators.map(operator => (
                                       <TableRow key={operator.uid} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/operators/${operator.uid}`)}>
                                           <TableCell className="font-medium">{`${operator.firstName || ''} ${operator.lastName || ''}`.trim() || '-'}</TableCell>
                                           <TableCell>{operator.email}</TableCell>
                                           <TableCell className="hidden md:table-cell"><Badge variant={operator.role === 'master' ? 'default' : 'secondary'} className="capitalize">{operator.role}</Badge></TableCell>
                                           <TableCell className="hidden sm:table-cell">{formatDateSafe(operator.lastLoginAt)}</TableCell>
                                           <TableCell className="text-right">
                                               <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenuItem onClick={() => router.push(`/operators/${operator.uid}`)}><Eye className="mr-2 h-4 w-4" />View Details</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => router.push(`/operators/${operator.uid}`)}><Edit className="mr-2 h-4 w-4" />Edit Operator</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => setOperatorToDelete(operator)} disabled={operator.uid === user?.uid}>
                                                            <Trash2 className="mr-2 h-4 w-4" />Delete Operator
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
                            <p className="text-lg">No operators found.</p>
                            <p className="text-sm">You are the only operator. Click "Add New Operator" to add more.</p>
                       </div>
                   )}
                </CardContent>
            </Card>

             <AlertDialog open={!!operatorToDelete} onOpenChange={(open) => !open && setOperatorToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the operator "{operatorToDelete?.email}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteOperator} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

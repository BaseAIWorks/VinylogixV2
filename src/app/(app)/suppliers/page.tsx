
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Briefcase, PlusCircle, Loader2, AlertTriangle, MoreVertical, Trash2, Edit } from "lucide-react";
import type { Supplier } from "@/types";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { getSuppliersByDistributorId, addSupplier, updateSupplier, deleteSupplier } from "@/services/supplier-service";

const emptyFormState: Omit<Supplier, 'id' | 'createdAt' | 'distributorId'> = {
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    notes: ""
};

export default function SuppliersPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [formState, setFormState] = useState(emptyFormState);

    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
    
    const fetchSuppliers = async () => {
        if (user && user.distributorId) {
            setIsLoading(true);
            try {
                const fetchedSuppliers = await getSuppliersByDistributorId(user.distributorId);
                setSuppliers(fetchedSuppliers);
            } catch (error) {
                toast({ title: "Error", description: "Could not fetch suppliers.", variant: "destructive"});
            } finally {
                setIsLoading(false);
            }
        }
    };

    useEffect(() => {
        if (user && !authLoading) {
            fetchSuppliers();
        }
    }, [user, authLoading]);

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormState(prev => ({ ...prev, [e.target.id]: e.target.value }));
    };

    const openAddDialog = () => {
        setEditingSupplier(null);
        setFormState(emptyFormState);
        setIsDialogOpen(true);
    };

    const openEditDialog = (supplier: Supplier) => {
        setEditingSupplier(supplier);
        setFormState(supplier);
        setIsDialogOpen(true);
    };

    const handleFormSubmit = async () => {
        if (!formState.name || !user || !user.distributorId) {
            toast({ title: "Validation Error", description: "Supplier name is required.", variant: "destructive"});
            return;
        }
        setIsSaving(true);
        
        try {
            if (editingSupplier) {
                await updateSupplier(user.distributorId, editingSupplier.id, formState);
            } else {
                await addSupplier(formState, user);
            }
            toast({ title: `Supplier ${editingSupplier ? 'Updated' : 'Added'}`, description: `"${formState.name}" has been saved.`});
            setIsDialogOpen(false);
            fetchSuppliers(); // Re-fetch the list
        } catch (error) {
            toast({ title: "Error", description: `Could not save supplier. ${(error as Error).message}`, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteSupplier = async () => {
        if (!supplierToDelete || !user || !user.distributorId) return;
        setIsSaving(true);
        
        try {
            await deleteSupplier(user.distributorId, supplierToDelete.id);
            toast({ title: "Supplier Deleted", description: `"${supplierToDelete.name}" has been deleted.` });
            fetchSuppliers(); // Re-fetch the list
        } catch (error) {
            toast({ title: "Error", description: `Failed to delete supplier. ${(error as Error).message}`, variant: "destructive" });
        } finally {
            setSupplierToDelete(null);
            setIsDeleteDialogOpen(false);
            setIsSaving(false);
        }
    };

    if (authLoading || isLoading) {
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
        <>
            <div className="space-y-6">
                 <Card className="shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-3">
                            <Briefcase className="h-6 w-6 text-primary" />
                            <span>Your Suppliers</span>
                        </CardTitle>
                        <Button onClick={openAddDialog}>
                            <PlusCircle className="mr-2 h-5 w-5" />
                            Add New Supplier
                        </Button>
                    </CardHeader>
                    <CardContent>
                       {suppliers.length > 0 ? (
                           <div className="overflow-x-auto">
                               <Table>
                                   <TableHeader>
                                       <TableRow>
                                           <TableHead>Supplier Name</TableHead>
                                           <TableHead className="hidden sm:table-cell">Contact Person</TableHead>
                                           <TableHead className="hidden md:table-cell">Email</TableHead>
                                           <TableHead className="text-right">Actions</TableHead>
                                       </TableRow>
                                   </TableHeader>
                                   <TableBody>
                                       {suppliers.map(supplier => (
                                           <TableRow key={supplier.id} className="border-b">
                                               <TableCell className="font-medium">{supplier.name}</TableCell>
                                               <TableCell className="hidden sm:table-cell">{supplier.contactPerson || '-'}</TableCell>
                                               <TableCell className="hidden md:table-cell">{supplier.email || '-'}</TableCell>
                                                <TableCell className="text-right">
                                                   <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenuItem onClick={() => openEditDialog(supplier)}>
                                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive" onClick={() => { setSupplierToDelete(supplier); setIsDeleteDialogOpen(true); }}>
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
                                <p className="text-lg">No suppliers found.</p>
                                <p className="text-sm">Click "Add New Supplier" to get started.</p>
                           </div>
                       )}
                    </CardContent>
                </Card>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
                        <DialogDescription>
                            {editingSupplier ? `Update the details for ${editingSupplier.name}.` : 'Enter the details for the new supplier.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                        <div className="space-y-2"><Label htmlFor="name">Supplier Name *</Label><Input id="name" value={formState.name} onChange={handleFormChange} /></div>
                        <div className="space-y-2"><Label htmlFor="contactPerson">Contact Person</Label><Input id="contactPerson" value={formState.contactPerson} onChange={handleFormChange} /></div>
                        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={formState.email} onChange={handleFormChange} /></div>
                        <div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" value={formState.phone} onChange={handleFormChange} /></div>
                        <div className="space-y-2"><Label htmlFor="address">Address</Label><Input id="address" value={formState.address} onChange={handleFormChange} /></div>
                        <div className="space-y-2"><Label htmlFor="website">Website</Label><Input id="website" value={formState.website} onChange={handleFormChange} /></div>
                        <div className="space-y-2"><Label htmlFor="notes">Notes</Label><Textarea id="notes" value={formState.notes} onChange={handleFormChange} /></div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" onClick={handleFormSubmit} disabled={isSaving}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            {editingSupplier ? 'Save Changes' : 'Add Supplier'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the supplier "{supplierToDelete?.name}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setSupplierToDelete(null)}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteSupplier} disabled={isSaving} className="bg-destructive hover:bg-destructive/90">
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

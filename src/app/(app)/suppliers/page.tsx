"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Briefcase, AlertTriangle, PlusCircle, MoreVertical, Edit, Trash2, Eye, Package, Calendar, Upload, Globe, Mail, Phone, MapPin } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Supplier, VinylRecord } from "@/types";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getSuppliersByDistributorId, addSupplier, updateSupplier, deleteSupplier } from "@/services/supplier-service";
import { getAllInventoryRecords } from "@/services/record-service";
import { DataTableToolbar } from "@/components/ui/data-table-toolbar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SupplierWithStats extends Supplier {
  recordCount: number;
  lastPurchaseDate: string | null;
}

export default function SuppliersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formWebsite, setFormWebsite] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [recordsFilter, setRecordsFilter] = useState<"all" | "has-records" | "no-records">("all");

  // CSV Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user || !user.distributorId || (user.role !== 'master' && !(user.role === 'worker' && user.permissions?.canEditSuppliers))) {
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    try {
      const [fetchedSuppliers, fetchedRecords] = await Promise.all([
        getSuppliersByDistributorId(user.distributorId),
        getAllInventoryRecords(user, user.distributorId),
      ]);
      setSuppliers(fetchedSuppliers);
      setRecords(fetchedRecords);
    } catch (error) {
      toast({ title: "Error", description: "Could not fetch suppliers.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [user, authLoading, fetchData]);

  // Compute supplier stats from records
  const suppliersWithStats: SupplierWithStats[] = useMemo(() => {
    return suppliers.map(supplier => {
      const supplierRecords = records.filter(r => r.supplier_id === supplier.id);
      const sortedByDate = [...supplierRecords].sort((a, b) => {
        const dateA = a.added_at ? new Date(a.added_at).getTime() : 0;
        const dateB = b.added_at ? new Date(b.added_at).getTime() : 0;
        return dateB - dateA;
      });
      const lastPurchaseDate = sortedByDate[0]?.added_at || null;

      return {
        ...supplier,
        recordCount: supplierRecords.length,
        lastPurchaseDate,
      };
    });
  }, [suppliers, records]);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    let result = suppliersWithStats;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(supplier =>
        supplier.name.toLowerCase().includes(query) ||
        (supplier.contactPerson?.toLowerCase() || '').includes(query)
      );
    }

    // Records filter
    if (recordsFilter === "has-records") {
      result = result.filter(s => s.recordCount > 0);
    } else if (recordsFilter === "no-records") {
      result = result.filter(s => s.recordCount === 0);
    }

    return result;
  }, [suppliersWithStats, searchQuery, recordsFilter]);

  const formatDateSafe = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    try {
      return format(parseISO(dateString), 'dd MMM yyyy');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormContactPerson("");
    setFormEmail("");
    setFormPhone("");
    setFormAddress("");
    setFormWebsite("");
    setFormNotes("");
    setEditingSupplier(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (open) {
      resetForm();
    }
    setIsAddDialogOpen(open);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormName(supplier.name);
    setFormContactPerson(supplier.contactPerson || "");
    setFormEmail(supplier.email || "");
    setFormPhone(supplier.phone || "");
    setFormAddress(supplier.address || "");
    setFormWebsite(supplier.website || "");
    setFormNotes(supplier.notes || "");
    setIsAddDialogOpen(true);
  };

  const handleSaveSupplier = async () => {
    if (!formName.trim()) {
      toast({ title: "Validation Error", description: "Supplier name is required.", variant: "destructive" });
      return;
    }
    if (!user?.distributorId) return;

    setIsSavingSupplier(true);
    try {
      const supplierData = {
        name: formName.trim(),
        contactPerson: formContactPerson.trim() || undefined,
        email: formEmail.trim() || undefined,
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        website: formWebsite.trim() || undefined,
        notes: formNotes.trim() || undefined,
      };

      if (editingSupplier) {
        await updateSupplier(user.distributorId, editingSupplier.id, supplierData);
        toast({ title: "Supplier Updated", description: `"${formName}" has been updated.` });
      } else {
        await addSupplier(supplierData, user);
        toast({ title: "Supplier Added", description: `"${formName}" has been added.` });
      }
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierToDelete || !user?.distributorId) return;
    try {
      await deleteSupplier(user.distributorId, supplierToDelete.id);
      toast({ title: "Supplier Deleted", description: `"${supplierToDelete.name}" has been deleted.` });
      fetchData();
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setSupplierToDelete(null);
    }
  };

  const handleCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          toast({ title: "Invalid CSV", description: "File must have a header row and at least one data row.", variant: "destructive" });
          return;
        }

        // Parse header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
        const nameIndex = header.findIndex(h => h === 'name' || h === 'supplier' || h === 'supplier name');
        const contactIndex = header.findIndex(h => h === 'contact' || h === 'contact person' || h === 'contactperson');
        const emailIndex = header.findIndex(h => h === 'email' || h === 'e-mail');
        const phoneIndex = header.findIndex(h => h === 'phone' || h === 'telephone' || h === 'tel');
        const addressIndex = header.findIndex(h => h === 'address');
        const websiteIndex = header.findIndex(h => h === 'website' || h === 'url');
        const notesIndex = header.findIndex(h => h === 'notes' || h === 'note' || h === 'comments');

        if (nameIndex === -1) {
          toast({ title: "Invalid CSV", description: "CSV must have a 'name' or 'supplier' column.", variant: "destructive" });
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
          const name = values[nameIndex];
          if (!name) continue;

          try {
            await addSupplier({
              name,
              contactPerson: contactIndex >= 0 ? values[contactIndex] : undefined,
              email: emailIndex >= 0 ? values[emailIndex] : undefined,
              phone: phoneIndex >= 0 ? values[phoneIndex] : undefined,
              address: addressIndex >= 0 ? values[addressIndex] : undefined,
              website: websiteIndex >= 0 ? values[websiteIndex] : undefined,
              notes: notesIndex >= 0 ? values[notesIndex] : undefined,
            }, user);
            successCount++;
          } catch {
            errorCount++;
          }
        }

        toast({
          title: "Import Complete",
          description: `Successfully imported ${successCount} supplier(s).${errorCount > 0 ? ` ${errorCount} failed.` : ''}`,
        });
        fetchData();
      } catch (error) {
        toast({ title: "Import Failed", description: "Could not parse CSV file.", variant: "destructive" });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  // Count stats
  const hasRecordsCount = suppliersWithStats.filter(s => s.recordCount > 0).length;
  const noRecordsCount = suppliersWithStats.filter(s => s.recordCount === 0).length;

  if (authLoading || isLoadingData) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== 'master' && !(user?.role === 'worker' && user.permissions?.canEditSuppliers)) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to manage suppliers.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Briefcase className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>Your Suppliers</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {suppliersWithStats.length} supplier{suppliersWithStats.length !== 1 ? 's' : ''} · {hasRecordsCount} with records
              </p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <input
              type="file"
              accept=".csv"
              ref={fileInputRef}
              onChange={handleCSVImport}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import CSV
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button className="flex-1 md:flex-none">
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Add Supplier
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
                  <DialogDescription>
                    {editingSupplier ? 'Update supplier details.' : 'Add a new supplier to your list.'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                  <div className="space-y-2">
                    <Label htmlFor="supplierName">Name *</Label>
                    <Input
                      id="supplierName"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="Supplier name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplierContact">Contact Person</Label>
                    <Input
                      id="supplierContact"
                      value={formContactPerson}
                      onChange={e => setFormContactPerson(e.target.value)}
                      placeholder="Contact person name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplierEmail">Email</Label>
                      <Input
                        id="supplierEmail"
                        type="email"
                        value={formEmail}
                        onChange={e => setFormEmail(e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplierPhone">Phone</Label>
                      <Input
                        id="supplierPhone"
                        type="tel"
                        value={formPhone}
                        onChange={e => setFormPhone(e.target.value)}
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplierAddress">Address</Label>
                    <Input
                      id="supplierAddress"
                      value={formAddress}
                      onChange={e => setFormAddress(e.target.value)}
                      placeholder="Street, City, Country"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplierWebsite">Website</Label>
                    <Input
                      id="supplierWebsite"
                      type="url"
                      value={formWebsite}
                      onChange={e => setFormWebsite(e.target.value)}
                      placeholder="https://example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplierNotes">Notes</Label>
                    <Textarea
                      id="supplierNotes"
                      value={formNotes}
                      onChange={e => setFormNotes(e.target.value)}
                      placeholder="Additional notes..."
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button type="button" onClick={handleSaveSupplier} disabled={isSavingSupplier || !formName.trim()}>
                    {isSavingSupplier && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingSupplier ? 'Update' : 'Add'} Supplier
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar with search and filter */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <DataTableToolbar
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search by name or contact..."
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button
                variant={recordsFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setRecordsFilter("all")}
              >
                All
              </Button>
              <Button
                variant={recordsFilter === "has-records" ? "default" : "outline"}
                size="sm"
                onClick={() => setRecordsFilter("has-records")}
              >
                <Package className="mr-1 h-4 w-4" />
                Has Records ({hasRecordsCount})
              </Button>
              <Button
                variant={recordsFilter === "no-records" ? "default" : "outline"}
                size="sm"
                onClick={() => setRecordsFilter("no-records")}
              >
                No Records ({noRecordsCount})
              </Button>
            </div>
          </div>

          {filteredSuppliers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Contact</TableHead>
                    <TableHead className="hidden md:table-cell text-center">Records</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Purchase</TableHead>
                    <TableHead className="hidden xl:table-cell">Contact Info</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map(supplier => (
                    <TableRow key={supplier.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        {supplier.name}
                        {supplier.website && (
                          <a
                            href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-muted-foreground hover:text-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Globe className="h-3 w-3 inline" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {supplier.contactPerson || '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant={supplier.recordCount > 0 ? "default" : "secondary"}
                                className="cursor-pointer"
                                onClick={() => {
                                  if (supplier.recordCount > 0) {
                                    router.push(`/inventory?supplier=${supplier.id}`);
                                  }
                                }}
                              >
                                {supplier.recordCount}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {supplier.recordCount > 0
                                ? "Click to view records from this supplier"
                                : "No records from this supplier"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatDateSafe(supplier.lastPurchaseDate)}
                        </div>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {supplier.email && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Mail className="h-4 w-4 hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); window.location.href = `mailto:${supplier.email}`; }} />
                                </TooltipTrigger>
                                <TooltipContent>{supplier.email}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {supplier.phone && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Phone className="h-4 w-4 hover:text-primary cursor-pointer" onClick={(e) => { e.stopPropagation(); window.location.href = `tel:${supplier.phone}`; }} />
                                </TooltipTrigger>
                                <TooltipContent>{supplier.phone}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {supplier.address && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <MapPin className="h-4 w-4" />
                                </TooltipTrigger>
                                <TooltipContent>{supplier.address}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {supplier.recordCount > 0 && (
                              <DropdownMenuItem onClick={() => router.push(`/inventory?supplier=${supplier.id}`)}>
                                <Eye className="mr-2 h-4 w-4" />View Records
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleEditSupplier(supplier)}>
                              <Edit className="mr-2 h-4 w-4" />Edit Supplier
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setSupplierToDelete(supplier)}>
                              <Trash2 className="mr-2 h-4 w-4" />Delete Supplier
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
            <EmptyState
              icon={Briefcase}
              title="No suppliers found"
              description={
                searchQuery || recordsFilter !== "all"
                  ? "Try adjusting your search or filter."
                  : "Click 'Add Supplier' or 'Import CSV' to get started."
              }
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!supplierToDelete} onOpenChange={(open) => !open && setSupplierToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{supplierToDelete?.name}". Records associated with this supplier will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSupplier} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

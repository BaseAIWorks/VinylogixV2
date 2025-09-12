
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, FilePenLine, AlertTriangle, Save, ArrowLeft, ArrowRight, PlusCircle, X } from "lucide-react";
import type { VinylRecord } from "@/types";
import { getInventoryRecords, batchUpdateRecords } from "@/services/record-service";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";


type EditableRecordField = 'stock_shelves' | 'shelf_locations' | 'stock_storage' | 'storage_locations';

const RECORDS_PER_PAGE = 50;

// LocationSelector Component specifically for this page
const LocationSelector = ({
    recordId,
    locationType,
    selectedLocations,
    onLocationChange,
}: {
    recordId: string;
    locationType: 'shelf_locations' | 'storage_locations';
    selectedLocations: string[];
    onLocationChange: (recordId: string, type: 'shelf_locations' | 'storage_locations', newLocations: string[]) => void;
}) => {
    const { activeDistributor, updateMyDistributorSettings } = useAuth();
    const availableLocations = locationType === 'shelf_locations' ? activeDistributor?.shelfLocations || [] : activeDistributor?.storageLocations || [];
    const canManageLocations = useAuth().user?.role === 'master';
    
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const handleCreate = async () => {
        if (!canManageLocations || !search || availableLocations.includes(search)) return;
        const newLocations = [...availableLocations, search].sort();
        
        if (locationType === 'shelf_locations') {
            await updateMyDistributorSettings({ shelfLocations: newLocations });
        } else {
            await updateMyDistributorSettings({ storageLocations: newLocations });
        }
        
        onLocationChange(recordId, locationType, [...selectedLocations, search]);
        setSearch("");
        setOpen(false);
    };

    const filteredOptions = availableLocations.filter(loc => 
        !selectedLocations.includes(loc) && loc.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-2">
             <div className="rounded-md border p-1 min-h-[40px] flex flex-wrap gap-1">
                {selectedLocations.length > 0 ? selectedLocations.map((loc) => (
                    <Badge key={loc} variant="secondary" className="flex items-center gap-1">
                        {loc}
                        <button type="button" onClick={() => onLocationChange(recordId, locationType, selectedLocations.filter(l => l !== loc))} className="rounded-full hover:bg-destructive/20 text-destructive/80 hover:text-destructive"><X className="h-3 w-3"/></button>
                    </Badge>
                )) : null}
            </div>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full justify-start font-normal text-xs h-8">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Location
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0" align="start">
                    <Command>
                        <CommandInput
                            placeholder="Search locations..."
                            value={search}
                            onValueChange={setSearch}
                        />
                        <CommandList>
                            <CommandEmpty>
                                {canManageLocations ? (
                                    <Button variant="ghost" size="sm" className="w-full" onClick={handleCreate}>
                                        Create &quot;{search}&quot;
                                    </Button>
                                ) : (
                                    "No locations found."
                                )}
                            </CommandEmpty>
                            <CommandGroup>
                                {filteredOptions.map((loc) => (
                                    <CommandItem
                                        key={loc}
                                        onSelect={() => {
                                            onLocationChange(recordId, locationType, [...selectedLocations, loc]);
                                            setOpen(false);
                                        }}
                                    >
                                        {loc}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};


export default function BatchEditPage() {
    const { user, loading: authLoading, activeDistributorId } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [allRecords, setAllRecords] = useState<VinylRecord[]>([]);
    const [editedRecords, setEditedRecords] = useState<VinylRecord[]>([]);
    const [initialRecords, setInitialRecords] = useState<VinylRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const fetchLatestRecords = useCallback(async () => {
        if (!user || user.role !== 'master' || !activeDistributorId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const { records: fetchedRecords } = await getInventoryRecords(user, { 
                distributorId: activeDistributorId,
                limit: 1000 // Get all records for batch editing
            });
            
            fetchedRecords.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());

            setAllRecords(fetchedRecords);
            setEditedRecords(JSON.parse(JSON.stringify(fetchedRecords)));
            setInitialRecords(JSON.parse(JSON.stringify(fetchedRecords)));
        } catch (error) {
            toast({ title: "Error", description: `Could not fetch latest records: ${(error as Error).message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, activeDistributorId, toast]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchLatestRecords();
        }
    }, [user, authLoading, fetchLatestRecords]);

    const totalPages = Math.ceil(allRecords.length / RECORDS_PER_PAGE);
    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
        const endIndex = startIndex + RECORDS_PER_PAGE;
        return editedRecords.slice(startIndex, endIndex);
    }, [editedRecords, currentPage]);


    const handleInputChange = (recordId: string, field: 'stock_shelves' | 'stock_storage', value: string | number) => {
        setEditedRecords(prevRecords =>
            prevRecords.map(record => {
                if (record.id === recordId) {
                    return { ...record, [field]: value };
                }
                return record;
            })
        );
    };

    const handleLocationChange = (recordId: string, field: 'shelf_locations' | 'storage_locations', newLocations: string[]) => {
        setEditedRecords(prevRecords =>
            prevRecords.map(record => {
                if (record.id === recordId) {
                    return { ...record, [field]: newLocations };
                }
                return record;
            })
        );
    };

    const getModifiedRecords = () => {
        return editedRecords.filter(record => {
            const initialRecord = initialRecords.find(r => r.id === record.id);
            if (!initialRecord) return false;
            
            const editableFields: EditableRecordField[] = ['stock_shelves', 'shelf_locations', 'stock_storage', 'storage_locations'];
            return editableFields.some(field => {
                const currentValue = record[field as keyof VinylRecord];
                const initialValue = initialRecord[field as keyof VinylRecord];

                // Handle array comparison for locations
                if (Array.isArray(currentValue) || Array.isArray(initialValue)) {
                    const currentArr = Array.isArray(currentValue) ? currentValue.sort() : [];
                    const initialArr = Array.isArray(initialValue) ? initialValue.sort() : [];
                    return JSON.stringify(currentArr) !== JSON.stringify(initialArr);
                }
                
                // Handle numeric/string comparison for stock
                return String(currentValue || 0) !== String(initialValue || 0);
            });
        }).map(record => {
            const { id, stock_shelves, shelf_locations, stock_storage, storage_locations } = record;
            return { id, stock_shelves, shelf_locations, stock_storage, storage_locations };
        });
    };


    const handleSaveChanges = async () => {
        if (!user) return;
        const modifiedRecords = getModifiedRecords();
        
        if (modifiedRecords.length === 0) {
            toast({ title: "No Changes", description: "There are no changes to save." });
            return;
        }

        setIsSaving(true);
        try {
            await batchUpdateRecords(modifiedRecords, user);
            toast({ title: "Success", description: `${modifiedRecords.length} record(s) have been updated.` });
            fetchLatestRecords();
        } catch (error) {
            toast({ title: "Error", description: `Could not save changes: ${(error as Error).message}`, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };
    
    if (authLoading || isLoading) {
        return <div className="flex items-center justify-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (user?.role !== 'master') {
        return (
            <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
                <p className="text-muted-foreground mt-2">Only Master users can access this page.</p>
            </div>
        );
    }
    
    const modifiedCount = getModifiedRecords().length;

    return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                     <div>
                        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3"><FilePenLine className="h-8 w-8 text-primary"/> Batch Edit Inventory</h2>
                        <p className="text-muted-foreground">Quickly edit inventory fields for all records. Use the pagination controls at the bottom.</p>
                    </div>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button disabled={modifiedCount === 0 || isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save {modifiedCount > 0 ? `${modifiedCount} Change(s)` : 'Changes'}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Changes</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You are about to save changes to {modifiedCount} record(s). This action cannot be undone. Are you sure?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleSaveChanges}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Save Changes
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>

                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="sticky left-0 bg-card z-10 min-w-[150px]">Artist</TableHead>
                                    <TableHead className="min-w-[150px]">Title</TableHead>
                                    <TableHead className="hidden md:table-cell min-w-[150px]">Barcode</TableHead>
                                    <TableHead className="hidden lg:table-cell min-w-[120px]">Discogs ID</TableHead>
                                    <TableHead className="min-w-[100px]">Shelf Stock</TableHead>
                                    <TableHead className="hidden sm:table-cell min-w-[200px]">Shelf Location(s)</TableHead>
                                    <TableHead className="min-w-[100px]">Storage Stock</TableHead>
                                    <TableHead className="hidden sm:table-cell min-w-[200px]">Storage Location(s)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedRecords.map(record => {
                                    return (
                                        <TableRow key={record.id}>
                                            <TableCell className="sticky left-0 bg-card font-medium truncate">{record.artist}</TableCell>
                                            <TableCell className="truncate">{record.title}</TableCell>
                                            <TableCell className="hidden md:table-cell">{record.barcode || "N/A"}</TableCell>
                                            <TableCell className="hidden lg:table-cell">{record.discogs_id || "N/A"}</TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={record.stock_shelves || ''}
                                                    onChange={(e) => handleInputChange(record.id, 'stock_shelves', parseInt(e.target.value) || 0)}
                                                    className="h-8"
                                                />
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <LocationSelector
                                                    recordId={record.id}
                                                    locationType="shelf_locations"
                                                    selectedLocations={record.shelf_locations || []}
                                                    onLocationChange={handleLocationChange}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={record.stock_storage || ''}
                                                    onChange={(e) => handleInputChange(record.id, 'stock_storage', parseInt(e.target.value) || 0)}
                                                    className="h-8"
                                                />
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                    <LocationSelector
                                                    recordId={record.id}
                                                    locationType="storage_locations"
                                                    selectedLocations={record.storage_locations || []}
                                                    onLocationChange={handleLocationChange}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                 <div className="flex items-center justify-end space-x-2 py-4">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                        <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </div>
            </div>
    )
}

    

"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, FilePenLine, AlertTriangle, Save, ArrowLeft, ArrowRight, PlusCircle, X, Search, Undo2, CheckCircle } from "lucide-react";
import type { VinylRecord } from "@/types";
import { getInventoryRecords, batchUpdateRecords } from "@/services/record-service";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";


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
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    searchInputRef.current?.focus();
                }
            }
            if (e.key === 'Escape') {
                setSearchQuery("");
                searchInputRef.current?.blur();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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

    // Filter records by search query
    const filteredRecords = useMemo(() => {
        if (!searchQuery.trim()) return editedRecords;
        const query = searchQuery.toLowerCase();
        return editedRecords.filter(r =>
            r.artist.toLowerCase().includes(query) ||
            r.title.toLowerCase().includes(query) ||
            (r.barcode && r.barcode.toLowerCase().includes(query)) ||
            (r.discogs_id && r.discogs_id.toString().includes(query))
        );
    }, [editedRecords, searchQuery]);

    const totalPages = Math.ceil(filteredRecords.length / RECORDS_PER_PAGE);
    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * RECORDS_PER_PAGE;
        const endIndex = startIndex + RECORDS_PER_PAGE;
        return filteredRecords.slice(startIndex, endIndex);
    }, [filteredRecords, currentPage]);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    // Check if a record has been modified
    const isRecordModified = useCallback((recordId: string) => {
        const currentRecord = editedRecords.find(r => r.id === recordId);
        const initialRecord = initialRecords.find(r => r.id === recordId);
        if (!currentRecord || !initialRecord) return false;

        const editableFields: EditableRecordField[] = ['stock_shelves', 'shelf_locations', 'stock_storage', 'storage_locations'];
        return editableFields.some(field => {
            const currentValue = currentRecord[field as keyof VinylRecord];
            const initialValue = initialRecord[field as keyof VinylRecord];
            if (Array.isArray(currentValue) || Array.isArray(initialValue)) {
                const currentArr = Array.isArray(currentValue) ? [...currentValue].sort() : [];
                const initialArr = Array.isArray(initialValue) ? [...initialValue].sort() : [];
                return JSON.stringify(currentArr) !== JSON.stringify(initialArr);
            }
            return String(currentValue || 0) !== String(initialValue || 0);
        });
    }, [editedRecords, initialRecords]);

    // Revert a single record
    const revertRecord = useCallback((recordId: string) => {
        const initialRecord = initialRecords.find(r => r.id === recordId);
        if (!initialRecord) return;
        setEditedRecords(prev =>
            prev.map(r => r.id === recordId ? JSON.parse(JSON.stringify(initialRecord)) : r)
        );
        toast({ title: "Reverted", description: "Changes to this record have been undone." });
    }, [initialRecords, toast]);

    // Revert all changes
    const revertAllChanges = useCallback(() => {
        setEditedRecords(JSON.parse(JSON.stringify(initialRecords)));
        toast({ title: "All Changes Reverted", description: "All modifications have been undone." });
    }, [initialRecords, toast]);


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
        setSaveSuccess(false);
        try {
            await batchUpdateRecords(modifiedRecords, user);
            setSaveSuccess(true);
            toast({ title: "Success", description: `${modifiedRecords.length} record(s) have been updated.` });
            setTimeout(() => {
                setSaveSuccess(false);
                fetchLatestRecords();
            }, 1500);
        } catch (error) {
            toast({ title: "Error", description: `Could not save changes: ${(error as Error).message}`, variant: "destructive" });
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

    // Calculate stock summary
    const stockSummary = useMemo(() => {
        return editedRecords.reduce((acc, r) => {
            acc.totalShelf += r.stock_shelves || 0;
            acc.totalStorage += r.stock_storage || 0;
            return acc;
        }, { totalShelf: 0, totalStorage: 0 });
    }, [editedRecords]);

    return (
            <div className="space-y-6">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                                <FilePenLine className="h-8 w-8 text-primary"/>
                                Batch Edit Inventory
                            </h2>
                            <p className="text-muted-foreground">
                                Quickly edit stock levels and locations. Press <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded">/</kbd> to search.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {modifiedCount > 0 && (
                                <Button variant="outline" onClick={revertAllChanges} disabled={isSaving}>
                                    <Undo2 className="mr-2 h-4 w-4" />
                                    Revert All
                                </Button>
                            )}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        disabled={modifiedCount === 0 || isSaving}
                                        className={cn(
                                            "transition-all",
                                            saveSuccess && "bg-green-600 hover:bg-green-600"
                                        )}
                                    >
                                        {saveSuccess ? (
                                            <CheckCircle className="mr-2 h-4 w-4" />
                                        ) : isSaving ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : (
                                            <Save className="mr-2 h-4 w-4" />
                                        )}
                                        {saveSuccess ? 'Saved!' : `Save ${modifiedCount > 0 ? `${modifiedCount} Change(s)` : 'Changes'}`}
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
                    </div>

                    {/* Stats Summary and Search */}
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex flex-wrap gap-3">
                            <Badge variant="secondary" className="text-sm">
                                {allRecords.length} records
                            </Badge>
                            <Badge variant="outline" className="text-sm">
                                Shelf: {stockSummary.totalShelf} units
                            </Badge>
                            <Badge variant="outline" className="text-sm">
                                Storage: {stockSummary.totalStorage} units
                            </Badge>
                            {modifiedCount > 0 && (
                                <Badge variant="default" className="text-sm bg-amber-500">
                                    {modifiedCount} modified
                                </Badge>
                            )}
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                ref={searchInputRef}
                                placeholder="Search records..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                            {searchQuery && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                                    onClick={() => setSearchQuery("")}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        {paginatedRecords.length > 0 ? (
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
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedRecords.map(record => {
                                        const isModified = isRecordModified(record.id);
                                        return (
                                            <TableRow
                                                key={record.id}
                                                className={cn(
                                                    isModified && "bg-amber-50 dark:bg-amber-950/20 border-l-2 border-l-amber-500"
                                                )}
                                            >
                                                <TableCell className={cn(
                                                    "sticky left-0 font-medium truncate",
                                                    isModified ? "bg-amber-50 dark:bg-amber-950/20" : "bg-card"
                                                )}>
                                                    {record.artist}
                                                </TableCell>
                                                <TableCell className="truncate">{record.title}</TableCell>
                                                <TableCell className="hidden md:table-cell">{record.barcode || "N/A"}</TableCell>
                                                <TableCell className="hidden lg:table-cell">{record.discogs_id || "N/A"}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={record.stock_shelves || ''}
                                                        onChange={(e) => handleInputChange(record.id, 'stock_shelves', parseInt(e.target.value) || 0)}
                                                        className={cn("h-8", isModified && "border-amber-400")}
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
                                                        className={cn("h-8", isModified && "border-amber-400")}
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
                                                <TableCell>
                                                    {isModified && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => revertRecord(record.id)}
                                                            title="Revert changes"
                                                        >
                                                            <Undo2 className="h-4 w-4 text-muted-foreground" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="p-8">
                                <EmptyState
                                    icon={FilePenLine}
                                    title={searchQuery ? "No matching records" : "No inventory records"}
                                    description={
                                        searchQuery
                                            ? "Try adjusting your search query."
                                            : "Add records to your inventory to start batch editing."
                                    }
                                    action={
                                        searchQuery ? (
                                            <Button variant="outline" onClick={() => setSearchQuery("")}>
                                                Clear Search
                                            </Button>
                                        ) : (
                                            <Button onClick={() => router.push('/inventory')}>
                                                Go to Inventory
                                            </Button>
                                        )
                                    }
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>
                {paginatedRecords.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
                        <span className="text-sm text-muted-foreground">
                            {searchQuery ? (
                                <>Showing {filteredRecords.length} of {allRecords.length} records</>
                            ) : (
                                <>Page {currentPage} of {totalPages} ({allRecords.length} records)</>
                            )}
                        </span>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Previous
                            </Button>
                            <span className="text-sm font-medium px-2">
                                {currentPage} / {totalPages || 1}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                Next
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
    )
}

    
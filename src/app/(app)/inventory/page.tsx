
"use client";
import RecordCard from "@/components/records/record-card";
import CompactRecordCard from "@/components/records/compact-record-card";
import RecordFilters from "@/components/records/record-filters";
import { Button } from "@/components/ui/button";
import type { VinylRecord, SortOption } from "@/types";
import { PlusCircle, Search, Music2, LayoutGrid, List, Edit3, Loader2, Package, Heart, Store, Warehouse, Info, Disc3, RefreshCw, FilePenLine, Grid3x3, Presentation, ShoppingCart, Pencil, X, Trash2, Tag, Check, CheckSquare } from "lucide-react";
import Link from "next/link";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { getInventoryRecords, updateRecordStock } from "@/services/record-service";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DocumentSnapshot } from "firebase/firestore";
import { BulkActionsBar } from "@/components/ui/bulk-actions-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";


export default function InventoryPage() {
  const { 
    user, loading: authLoading, toggleFavorite, activeDistributorId, activeDistributor, 
    isFetchingDiscogsInventory, discogsInventoryReleaseIds, syncDiscogsInventory, 
    globalSearchTerm, setGlobalSearchTerm, addToCart
  } = useAuth(); 
  
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const router = useRouter();
  const [filters, setFilters] = useState<{ location?: string; year?: string; genre?: string; condition?: string; format?: string }>({});
  const [sortOption, setSortOption] = useState<SortOption>("added_at_desc");

  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');

  // Bulk edit mode
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [activePreset, setActivePreset] = useState<string | null>(null);

  const { toast } = useToast();
  const isMobile = useIsMobile();
  const observerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const isOperator = user?.role === 'master' || user?.role === 'worker';

  const cardSettings = activeDistributor?.cardDisplaySettings || {
    showTitle: true,
    showArtist: true,
    showYear: false,
    showCountry: false,
    showShelfStock: true,
    showStorageStock: true,
    showTotalStock: true,
    showFormat: false,
  };
  
  const fetchPaginatedRecords = useCallback(async (loadMore = false) => {
    if (!user || !activeDistributorId) {
      if (!loadMore) setRecords([]);
      setIsFetching(false);
      return;
    }

    if (loadMore) {
        if (isFetchingMore || !hasMore) return;
        setIsFetchingMore(true);
    } else {
        setIsFetching(true);
        setLastVisible(null);
        setHasMore(true);
    }
    
    try {
        const { records: fetchedRecords, lastVisible: newLastVisible } = await getInventoryRecords(user, {
            distributorId: activeDistributorId,
            filters,
            sortOption,
            limit: 25,
            lastVisible: loadMore ? lastVisible : null,
        });
        
        setRecords(loadMore ? [...records, ...fetchedRecords] : fetchedRecords);
        setLastVisible(newLastVisible);
        setHasMore(fetchedRecords.length === 25);
    } catch (error) {
        const errorMessage = (error as Error).message || "An unknown error occurred.";
        const errorDescription = `Could not load inventory records. ${errorMessage}`;
        toast({ title: "Error Loading Inventory", description: errorDescription, variant: "destructive", duration: 15000 });
    } finally {
        setIsFetching(false);
        setIsFetchingMore(false);
    }
  }, [user, activeDistributorId, filters, sortOption, toast, isFetchingMore, hasMore, lastVisible, records]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          fetchPaginatedRecords(true);
        }
      },
      { threshold: 1.0 }
    );

    const currentObserver = observerRef.current;
    if (currentObserver) {
      observer.observe(currentObserver);
    }

    return () => {
      if (currentObserver) {
        observer.unobserve(currentObserver);
      }
    };
  }, [hasMore, isFetchingMore, fetchPaginatedRecords]);

  useEffect(() => {
    fetchPaginatedRecords(false);
  }, [authLoading, user, activeDistributorId, filters, sortOption]);
  

  const filteredRecords = useMemo(() => {
    const lowerSearchTerm = globalSearchTerm.toLowerCase().trim();
    if (!lowerSearchTerm) return records;
    return records.filter(record => 
        record.title?.toLowerCase().includes(lowerSearchTerm) ||
        record.artist?.toLowerCase().includes(lowerSearchTerm) ||
        (record.barcode && record.barcode.toLowerCase().includes(lowerSearchTerm)) ||
        (record.shelf_locations && record.shelf_locations.some(loc => loc.toLowerCase().includes(lowerSearchTerm))) ||
        (record.storage_locations && record.storage_locations.some(loc => loc.toLowerCase().includes(lowerSearchTerm)))
    );
  }, [records, globalSearchTerm]);
  
  const dynamicFilterOptions = useMemo(() => {
    if (!records || records.length === 0) {
        return { locations: [], years: [], genres: [], conditions: [], formats: [] };
    }

    const locations = new Set<string>();
    const years = new Set<string>();
    const genres = new Set<string>();
    const conditions = new Set<string>();
    const formats = new Set<string>();

    records.forEach(record => {
        if (record.storage_location) locations.add(record.storage_location);
        if (record.year) years.add(record.year.toString());
        if (record.media_condition) conditions.add(record.media_condition);
        if (Array.isArray(record.genre)) {
            record.genre.forEach(g => genres.add(g));
        }
        record.formatDetails?.split(',').forEach(f => {
            if (f.trim()) formats.add(f.trim());
        });
    });

    const sortAndReturn = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return {
        locations: sortAndReturn(locations),
        years: Array.from(years).sort((a, b) => parseInt(b, 10) - parseInt(a, 10)),
        genres: sortAndReturn(genres),
        conditions: sortAndReturn(conditions),
        formats: sortAndReturn(formats),
    };
  }, [records]);

  const handleToggleFavorite = async (recordId: string) => {
    if (user?.role === 'viewer') {
      await toggleFavorite(recordId);
    }
  };

  const handleAddToCartClick = (e: React.MouseEvent, record: VinylRecord) => {
    e.preventDefault();
    e.stopPropagation();
    if (user?.role === 'viewer' && activeDistributorId) {
        addToCart(record, 1, activeDistributorId);
    }
  };

  // Quick stock update handler
  const handleQuickStockUpdate = useCallback(async (recordId: string, type: 'shelf' | 'storage', delta: number) => {
    if (!user) return;
    try {
      await updateRecordStock(recordId, type, delta);
      // Update local state
      setRecords(prev => prev.map(r => {
        if (r.id === recordId) {
          const key = type === 'shelf' ? 'stock_shelves' : 'stock_storage';
          return { ...r, [key]: Math.max(0, (r[key] || 0) + delta) };
        }
        return r;
      }));
    } catch (error) {
      toast({ title: "Error", description: "Failed to update stock.", variant: "destructive" });
      throw error;
    }
  }, [user, toast]);

  // Selection handlers
  const handleSelectRecord = useCallback((recordId: string) => {
    setSelectedRecords(prev => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedRecords.size === filteredRecords.length) {
      setSelectedRecords(new Set());
    } else {
      setSelectedRecords(new Set(filteredRecords.map(r => r.id)));
    }
  }, [filteredRecords, selectedRecords.size]);

  const handleClearSelection = useCallback(() => {
    setSelectedRecords(new Set());
    setBulkEditMode(false);
  }, []);

  // Bulk delete handler
  const handleBulkDelete = useCallback(async () => {
    // This would require a delete function in record-service
    toast({ title: "Delete", description: `Would delete ${selectedRecords.size} records. Feature coming soon.` });
  }, [selectedRecords.size, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        // But allow Escape to blur the input
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      // "/" - Focus search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      // "n" - New record (navigate to add page)
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && isOperator) {
        e.preventDefault();
        router.push('/scan');
      }

      // "e" - Toggle bulk edit mode
      if (e.key === 'e' && !e.metaKey && !e.ctrlKey && isOperator) {
        e.preventDefault();
        setBulkEditMode(prev => !prev);
        if (bulkEditMode) {
          setSelectedRecords(new Set());
        }
      }

      // Escape - Clear selection or exit bulk edit mode
      if (e.key === 'Escape') {
        if (selectedRecords.size > 0) {
          setSelectedRecords(new Set());
        } else if (bulkEditMode) {
          setBulkEditMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, isOperator, bulkEditMode, selectedRecords.size]);

  useEffect(() => {
    if (isMobile) {
      setViewMode('list');
    }
  }, [isMobile]);

  const pageTitle = user?.role === 'viewer' ? 'Catalog' : 'Inventory';
  const activeDistributorName = activeDistributor?.name;

  if (authLoading || isFetching) {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-3 text-lg">Loading user data...</p>
        </div>
    );
  }
  
  return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
            {user?.role === 'viewer' && activeDistributor && (
                <Image src={activeDistributor.logoUrl || '/logo.png'} alt={`${activeDistributorName} Logo`} width={40} height={40} style={{ width: '40px', height: '40px' }} className="rounded-md object-contain" onError={(e) => e.currentTarget.src='/logo.png'} unoptimized={true} />
            )}
            <h1 className="text-3xl font-bold tracking-tight text-foreground hidden sm:block">{pageTitle}</h1>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              placeholder="Search by title, artist, barcode, or location... (Press /)"
              className="pl-10 w-full"
              value={globalSearchTerm}
              onChange={(e) => setGlobalSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <RecordFilters
              filters={filters}
              setFilters={setFilters}
              sortOption={sortOption}
              setSortOption={setSortOption}
              filterOptions={dynamicFilterOptions}
              activePreset={activePreset || undefined}
              onApplyPreset={setActivePreset}
            />
            {isOperator && (
              <Button
                variant={bulkEditMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setBulkEditMode(!bulkEditMode);
                  if (bulkEditMode) setSelectedRecords(new Set());
                }}
                className="hidden sm:inline-flex gap-1.5"
              >
                {bulkEditMode ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                <span>{bulkEditMode ? "Exit Edit" : "Bulk Edit"}</span>
              </Button>
            )}
            {isOperator && user?.discogsUsername && (
                <Button
                    variant="outline"
                    onClick={syncDiscogsInventory}
                    disabled={isFetchingDiscogsInventory}
                    className="hidden sm:inline-flex"
                >
                    {isFetchingDiscogsInventory ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    <span>Sync Discogs</span>
                </Button>
            )}
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => router.push('/inventory/presentation')} 
              aria-label="Presentation Mode"
              className="hidden sm:inline-flex"
            >
              <Presentation className="h-5 w-5" />
            </Button>
            <Button 
              variant={viewMode === 'grid' ? 'secondary' : 'outline'} 
              size="icon" 
              onClick={() => setViewMode('grid')} 
              aria-label="Grid View"
            >
              <LayoutGrid className="h-5 w-5" />
            </Button>
            <Button 
              variant={viewMode === 'compact' ? 'secondary' : 'outline'} 
              size="icon" 
              onClick={() => setViewMode('compact')} 
              aria-label="Compact Grid View"
            >
              <Grid3x3 className="h-5 w-5" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'secondary' : 'outline'} 
              size="icon" 
              onClick={() => setViewMode('list')} 
              aria-label="List View"
            >
              <List className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {filteredRecords.length === 0 && !isFetchingMore ? (
          <div className="text-center py-12">
            <Music2 className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold text-foreground">No Records Found</h3>
            <p className="mt-2 text-muted-foreground">
              {globalSearchTerm || Object.values(filters).some(f => f) ? "Try adjusting your search or filters." : (user?.role === 'viewer' && !activeDistributorId) ? "Please select a distributor's catalog to begin browsing." : "The inventory is empty. Check back later!"}
            </p>
            {user?.role !== 'viewer' && (
              <Button asChild className="mt-6 bg-accent hover:bg-accent/90 text-accent-foreground">
                <Link href="/scan">
                  <span className="flex items-center gap-2">
                    <PlusCircle className="mr-2 h-5 w-5" /> Add Vinyl
                  </span>
                </Link>
              </Button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
            <>
              {bulkEditMode && isOperator && (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg mb-4">
                  <Checkbox
                    checked={selectedRecords.size === filteredRecords.length && filteredRecords.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    {selectedRecords.size > 0
                      ? `${selectedRecords.size} selected`
                      : "Select all"}
                  </span>
                  {selectedRecords.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                      Clear
                    </Button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                {filteredRecords.map((record) => (
                  <RecordCard
                      key={record.id}
                      record={record}
                      isOperator={isOperator}
                      isFavorite={user?.role === 'viewer' && user?.favorites?.includes(record.id)}
                      onToggleFavorite={user?.role === 'viewer' ? () => handleToggleFavorite(record.id) : undefined}
                      isInInventory={true}
                      isInDiscogs={!!(record.discogs_id && discogsInventoryReleaseIds.has(record.discogs_id))}
                      onQuickStockUpdate={bulkEditMode && isOperator ? handleQuickStockUpdate : undefined}
                      isSelected={selectedRecords.has(record.id)}
                      onSelect={bulkEditMode ? handleSelectRecord : undefined}
                      showCheckbox={bulkEditMode && isOperator}
                  />
                ))}
              </div>
            </>
          ) : viewMode === 'compact' ? (
             <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
              {filteredRecords.map((record) => (
                <CompactRecordCard 
                    key={record.id}
                    record={record}
                    isOperator={isOperator}
                    isFavorite={user?.role === 'viewer' && user?.favorites?.includes(record.id)}
                    onToggleFavorite={user?.role === 'viewer' ? () => handleToggleFavorite(record.id) : undefined}
                    isInDiscogs={!!(record.discogs_id && discogsInventoryReleaseIds.has(record.discogs_id))}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px] sm:w-[80px] p-2 sm:p-4"></TableHead>
                      {cardSettings.showTitle && <TableHead>Title</TableHead>}
                      {cardSettings.showArtist && <TableHead>Artist</TableHead>}
                      {cardSettings.showYear && <TableHead className="hidden md:table-cell">Year</TableHead>}
                      {cardSettings.showShelfStock && <TableHead className="hidden md:table-cell">Shelf</TableHead>}
                      {cardSettings.showStorageStock && <TableHead className="hidden md:table-cell">Storage</TableHead>}
                      {cardSettings.showTotalStock && <TableHead className="hidden sm:table-cell">Total</TableHead>}
                      {cardSettings.showFormat && <TableHead className="hidden lg:table-cell">Format</TableHead>}
                      {isOperator && <TableHead className="hidden lg:table-cell text-center">Discogs</TableHead>}
                      <TableHead className="text-right pr-2 sm:pr-4">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => {
                      const totalStock = Number(record.stock_shelves || 0) + Number(record.stock_storage || 0);
                      const formats = record.formatDetails?.split(',').map(f => f.trim()) || [];
                      const displayFormats = formats.length > 3 ? `${formats.slice(0, 3).join(', ')}, and more...` : formats.join(', ');
                      const canBePurchased = !isOperator && record.isInventoryItem && totalStock > 0 && (record.sellingPrice ?? -1) >= 0;

                      return (
                        <TableRow
                          key={record.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors duration-150"
                          onClick={() => router.push(`/records/${record.id}`)}
                        >
                            <TableCell className="p-1 sm:p-2 align-middle">
                                <Image
                                  src={record.cover_url || `https://placehold.co/60x60.png`}
                                  alt={`${record.title} cover`}
                                  width={60}
                                  height={60}
                                  className="rounded-sm object-cover aspect-square"
                                  data-ai-hint={record.dataAiHint || "album cover"}
                                  unoptimized={record.cover_url?.includes('discogs.com')}
                                />
                            </TableCell>
                            {cardSettings.showTitle && <TableCell className="font-bold py-2 px-2 sm:px-4 align-top">{record.title}</TableCell>}
                            {cardSettings.showArtist && <TableCell className="text-sm text-muted-foreground py-2 px-2 sm:px-4 align-top">{record.artist}</TableCell>}
                            {cardSettings.showYear && <TableCell className="hidden md:table-cell align-middle text-sm">{record.year || 'N/A'}</TableCell>}
                            
                            {user?.role !== 'viewer' ? (
                              <>
                                {cardSettings.showShelfStock && (
                                  <TableCell className="hidden md:table-cell align-middle text-xs">
                                    <div>
                                      <p>Stock: <span className="font-semibold text-foreground">{record.stock_shelves || 0}</span></p>
                                      {record.shelf_location && <p className="text-muted-foreground">Loc: {record.shelf_location}</p>}
                                    </div>
                                  </TableCell>
                                )}
                                {cardSettings.showStorageStock && (
                                  <TableCell className="hidden md:table-cell align-middle text-xs">
                                    <div>
                                      <p>Stock: <span className="font-semibold text-foreground">{record.stock_storage || 0}</span></p>
                                      {record.storage_location && <p className="text-muted-foreground">Loc: {record.storage_location}</p>}
                                    </div>
                                  </TableCell>
                                )}
                              </>
                            ) : (
                               <>
                                {cardSettings.showShelfStock && <TableCell className="hidden md:table-cell text-center align-middle">-</TableCell>}
                                {cardSettings.showStorageStock && <TableCell className="hidden md:table-cell text-center align-middle">-</TableCell>}
                               </>
                            )}

                            {cardSettings.showTotalStock && <TableCell className="hidden sm:table-cell text-center align-middle font-medium">{totalStock}</TableCell>}
                            {cardSettings.showFormat && <TableCell className="hidden lg:table-cell align-middle text-xs">{displayFormats || 'N/A'}</TableCell>}
                            
                            {isOperator && (
                                <TableCell className="hidden lg:table-cell text-center align-middle">
                                    {record.discogs_id && discogsInventoryReleaseIds.has(record.discogs_id) && <Disc3 className="h-5 w-5 text-primary mx-auto" />}
                                </TableCell>
                            )}

                            <TableCell className="text-right py-2 px-1 sm:pr-4 align-middle space-x-0">
                                {user?.role === 'viewer' && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleFavorite(record.id);
                                    }}
                                    className="text-muted-foreground hover:text-primary h-8 w-8"
                                    aria-label={user?.favorites?.includes(record.id) ? "Remove from Favorites" : "Add to Favorites"}
                                >
                                    <Heart className={`h-4 w-4 ${user?.favorites?.includes(record.id) ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                                </Button>
                                )}
                                 {canBePurchased && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => handleAddToCartClick(e, record)}
                                        className="text-muted-foreground hover:text-primary h-8 w-8"
                                        aria-label="Add to cart"
                                    >
                                        <ShoppingCart className="h-4 w-4" />
                                    </Button>
                                )}
                                {user?.role !== 'viewer' && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={(e) => {
                                    e.stopPropagation(); 
                                    router.push(`/records/${record.id}/edit`);
                                    }}
                                    className="text-muted-foreground hover:text-accent h-8 w-8"
                                    aria-label="Edit Record"
                                >
                                    <Edit3 className="h-4 w-4" />
                                </Button>
                                )}
                            </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        
        {hasMore && !isFetchingMore && (
             <div ref={observerRef} style={{ height: '1px' }} />
        )}

        {isFetchingMore && (
             <div className="flex justify-center mt-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        )}

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={selectedRecords.size}
          onClear={handleClearSelection}
          actions={[
            {
              label: "Batch Edit",
              icon: Edit3,
              onClick: () => router.push('/inventory/batch-edit'),
              variant: "default",
            },
            {
              label: "Delete",
              icon: Trash2,
              onClick: handleBulkDelete,
              variant: "destructive",
            },
          ]}
        />

        {/* Keyboard shortcuts hint */}
        {isOperator && !isMobile && (
          <div className="fixed bottom-4 left-4 text-xs text-muted-foreground hidden lg:block">
            <span className="bg-muted px-1.5 py-0.5 rounded">/</span> Search
            <span className="mx-2">•</span>
            <span className="bg-muted px-1.5 py-0.5 rounded">n</span> New
            <span className="mx-2">•</span>
            <span className="bg-muted px-1.5 py-0.5 rounded">e</span> Bulk Edit
          </div>
        )}
      </div>
  );
}

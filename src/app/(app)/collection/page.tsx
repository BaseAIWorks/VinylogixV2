
"use client";
import RecordCard from "@/components/records/record-card";
import RecordFilters from "@/components/records/record-filters";
import { Button } from "@/components/ui/button";
import type { VinylRecord } from "@/types";
import { PlusCircle, Search, Music2, LayoutGrid, List, Edit3, Loader2, Library, Heart, AlertTriangle, ArrowLeft, Check } from "lucide-react"; 
import Link from "next/link";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { getRecordsByOwner, getInventoryBarcodes } from "@/services/record-service"; 
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";


export default function CollectionPage() {
  const { user, loading: authLoading, toggleFavorite, activeDistributorId } = useAuth(); 
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [inventoryBarcodes, setInventoryBarcodes] = useState<Set<string>>(new Set());
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<{ location?: string; artist?: string; year?: string; genre?: string; condition?: string }>({});
  const [sortOption, setSortOption] = useState("recently_added");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user && user.role !== 'viewer') {
      router.replace('/inventory');
    }
  }, [user, authLoading, router]);

  const fetchRecords = useCallback(async () => {
    if (!user) { 
      setIsLoadingRecords(false);
      return;
    }
    setIsLoadingRecords(true);
    try {
      // Fetch user's own collection records (not tied to a specific distributor view)
      const fetchedRecords = await getRecordsByOwner(user.uid);
      setRecords(fetchedRecords.filter(r => !r.isWishlist));

      // Fetch inventory barcodes for the *currently active* distributor to show stock status
      if (activeDistributorId) {
        const fetchedInventoryBarcodes = await getInventoryBarcodes(user, activeDistributorId);
        setInventoryBarcodes(new Set(fetchedInventoryBarcodes));
      } else {
        setInventoryBarcodes(new Set());
      }
    } catch (error) {
      console.error("CollectionPage: Failed to fetch records:", error);
      toast({ 
        title: "Error", 
        description: "Could not load your collection.", 
        variant: "destructive",
      });
    } finally {
      setIsLoadingRecords(false);
    }
  }, [toast, user, activeDistributorId]); 

  useEffect(() => {
    if (!authLoading && user && user.role === 'viewer') {
      fetchRecords();
    } else if (!authLoading && !user) {
      setRecords([]); 
      setIsLoadingRecords(false); 
    }
  }, [authLoading, user, fetchRecords]);
  
  const dynamicFilterOptions = useMemo(() => {
    const locations = new Set<string>();
    const artists = new Set<string>();
    const years = new Set<string>();
    const genres = new Set<string>();
    const conditions = new Set<string>();

    records.forEach(record => {
        if (record.storage_location) locations.add(record.storage_location);
        if (record.artist) artists.add(record.artist);
        if (record.year) years.add(record.year.toString());
        if (record.media_condition) conditions.add(record.media_condition);
        if (Array.isArray(record.genre)) {
          record.genre.forEach(g => genres.add(g));
        }
    });

    const sortAndReturn = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return {
        locations: sortAndReturn(locations),
        artists: sortAndReturn(artists),
        years: Array.from(years).sort((a, b) => parseInt(b, 10) - parseInt(a, 10)),
        genres: sortAndReturn(genres),
        conditions: sortAndReturn(conditions)
    };
  }, [records]);


  const filteredAndSortedRecords = useMemo(() => {
    let currentRecords = [...records]; 
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    currentRecords = currentRecords.filter(record =>
      record.title.toLowerCase().includes(lowerSearchTerm) ||
      record.artist.toLowerCase().includes(lowerSearchTerm) ||
      (record.storage_location && record.storage_location.toLowerCase().includes(lowerSearchTerm)) ||
      (record.barcode && record.barcode.toLowerCase().includes(lowerSearchTerm))
    );

    if (filters.artist) currentRecords = currentRecords.filter(r => r.artist.toLowerCase().includes(filters.artist!.toLowerCase()));
    if (filters.location) currentRecords = currentRecords.filter(r => r.storage_location?.toLowerCase().includes(filters.location!.toLowerCase()));
    if (filters.year) currentRecords = currentRecords.filter(r => r.year?.toString() === filters.year);
    if (filters.genre) currentRecords = currentRecords.filter(r => Array.isArray(r.genre) && r.genre.some(g => g.toLowerCase() === filters.genre!.toLowerCase()));
    if (filters.condition) currentRecords = currentRecords.filter(r => r.media_condition === filters.condition);

    if (sortOption === 'alphabetically') {
      currentRecords.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOption === 'recently_added') {
      currentRecords.sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
    }
    
    return currentRecords;
  }, [records, searchTerm, filters, sortOption]);

  if (authLoading || (isLoadingRecords && user)) {
    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  if (user && user.role !== 'viewer') {
    return (
       <div className="flex flex-col items-center justify-center text-center p-6">
         <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
         <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
         <p className="text-muted-foreground mt-2">This page is for Client accounts. Use 'Inventory' to manage business records.</p>
         <Button onClick={() => router.push('/inventory')} className="mt-6">
           <ArrowLeft className="mr-2 h-4 w-4" /> Go to Inventory
         </Button>
       </div>
   );
 }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3"><Library className="h-8 w-8 text-primary"/> My Collection</h2>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link href="/scan">
            <span className="flex items-center gap-2">
              <PlusCircle className="mr-2 h-5 w-5" />
              Add New Vinyl
            </span>
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative w-full md:flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input type="search" placeholder="Search your collection..." className="pl-10 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <RecordFilters filters={filters} setFilters={setFilters} sortOption={sortOption} setSortOption={setSortOption} filterOptions={dynamicFilterOptions} />
          <Button variant={viewMode === 'grid' ? 'secondary' : 'outline'} size="icon" onClick={() => setViewMode('grid')} aria-label="Grid View"><LayoutGrid className="h-5 w-5" /></Button>
          <Button variant={viewMode === 'list' ? 'secondary' : 'outline'} size="icon" onClick={() => setViewMode('list')} aria-label="List View"><List className="h-5 w-5" /></Button>
        </div>
      </div>
      
      {filteredAndSortedRecords.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredAndSortedRecords.map((record) => (
              <RecordCard 
                key={record.id} 
                record={record}
                isOperator={false}
                isFavorite={user?.favorites?.includes(record.id)}
                onToggleFavorite={() => toggleFavorite(record.id)}
                isInInventory={record.barcode ? inventoryBarcodes.has(record.barcode) : false}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow><TableHead className="w-[60px] sm:w-[80px] p-2 sm:p-4"></TableHead><TableHead>Title</TableHead><TableHead>Artist</TableHead><TableHead className="hidden md:table-cell">Year</TableHead><TableHead className="hidden lg:table-cell">In Stock</TableHead><TableHead className="text-right pr-2 sm:pr-4">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedRecords.map((record) => (
                    <TableRow key={record.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/records/${record.id}`)}>
                      <TableCell className="p-1 sm:p-2">
                        <Image src={record.cover_url || `https://placehold.co/60x60.png`} alt={`${record.title} cover`} width={60} height={60} className="rounded-sm object-cover aspect-square" data-ai-hint={record.dataAiHint || "album cover"} unoptimized={record.cover_url?.includes('discogs.com')} />
                      </TableCell>
                      <TableCell className="font-medium py-2 px-2 sm:px-4">{record.title}</TableCell>
                      <TableCell className="py-2 px-2 sm:px-4">{record.artist}</TableCell>
                      <TableCell className="hidden md:table-cell py-2 px-2 sm:px-4">{record.year || 'N/A'}</TableCell>
                      <TableCell className="hidden lg:table-cell py-2 px-2 sm:px-4">
                         {record.barcode && inventoryBarcodes.has(record.barcode) ? <Check className="h-5 w-5 text-primary"/> : '-'}
                      </TableCell>
                      <TableCell className="text-right py-2 px-1 sm:pr-4">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); toggleFavorite(record.id);}} className="text-muted-foreground hover:text-primary h-8 w-8" aria-label="Toggle Favorite">
                            <Heart className={`h-4 w-4 ${user?.favorites?.includes(record.id) ? 'fill-primary text-primary' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); router.push(`/records/${record.id}/edit`);}} className="text-muted-foreground hover:text-accent h-8 w-8" aria-label="Edit Record">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )
      ) : (
          <div className="text-center py-12">
            <Music2 className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold text-foreground">No Records in Your Collection</h3>
            <p className="mt-2 text-muted-foreground">
              {searchTerm || Object.values(filters).some(f => f) ? "Try adjusting your search or filters." : "Your collection is empty. Start by adding some vinyls!"}
            </p>
            <Button asChild className="mt-6 bg-accent hover:bg-accent/90 text-accent-foreground"><Link href="/scan"><span className="flex items-center gap-2"><PlusCircle className="mr-2 h-5 w-5" /> Add Vinyl</span></Link></Button>
          </div>
      )}
    </div>
  );
}


"use client";
import ProtectedRoute from "@/components/layout/protected-route";
import RecordCard from "@/components/records/record-card";
import { Button } from "@/components/ui/button";
import type { VinylRecord } from "@/types";
import { PlusCircle, Search, Music2, LayoutGrid, List, Edit3, Loader2, ListChecks, ArrowLeft, Check } from "lucide-react"; 
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

export default function WishlistPage() {
  const { user, loading: authLoading, toggleFavorite, activeDistributorId } = useAuth(); 
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [inventoryBarcodes, setInventoryBarcodes] = useState<Set<string>>(new Set());
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const router = useRouter();
  const { toast } = useToast();

  const fetchRecords = useCallback(async () => {
    if (!user) { 
      setIsLoadingRecords(false);
      return;
    }
    setIsLoadingRecords(true);
    try {
      const [fetchedRecords, fetchedInventoryBarcodes] = await Promise.all([
        getRecordsByOwner(user.uid),
        getInventoryBarcodes(user, activeDistributorId)
      ]);
      setRecords(fetchedRecords.filter(r => r.isWishlist));
      setInventoryBarcodes(new Set(fetchedInventoryBarcodes));
    } catch (error) {
      console.error("WishlistPage: Failed to fetch records:", error);
      toast({ 
        title: "Error", 
        description: "Could not load your wishlist.", 
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

  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return records.filter(record =>
      record.title.toLowerCase().includes(lowerSearchTerm) ||
      record.artist.toLowerCase().includes(lowerSearchTerm)
    );
  }, [records, searchTerm]);

  if (authLoading || (isLoadingRecords && user)) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3"><ListChecks className="h-8 w-8 text-primary"/> My Wishlist</h2>
          <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Link href="/scan">
              <span className="flex items-center gap-2">
                <PlusCircle className="mr-2 h-5 w-5" />
                Add to Wishlist
              </span>
            </Link>
          </Button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-full md:flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input type="search" placeholder="Search your wishlist..." className="pl-10 w-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Button variant={viewMode === 'grid' ? 'secondary' : 'outline'} size="icon" onClick={() => setViewMode('grid')} aria-label="Grid View"><LayoutGrid className="h-5 w-5" /></Button>
            <Button variant={viewMode === 'list' ? 'secondary' : 'outline'} size="icon" onClick={() => setViewMode('list')} aria-label="List View"><List className="h-5 w-5" /></Button>
          </div>
        </div>
        
        {filteredRecords.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {filteredRecords.map((record) => (
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
                    <TableRow><TableHead className="w-[60px] sm:w-[80px] p-2 sm:p-4"></TableHead><TableHead>Title</TableHead><TableHead>Artist</TableHead><TableHead>In Stock</TableHead><TableHead className="text-right pr-2 sm:pr-4">Actions</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/records/${record.id}`)}>
                        <TableCell className="p-1 sm:p-2">
                          <Image src={record.cover_url || `https://placehold.co/60x60.png`} alt={`${record.title} cover`} width={60} height={60} className="rounded-sm object-cover aspect-square" data-ai-hint={record.dataAiHint || "album cover"} unoptimized={record.cover_url?.includes('discogs.com')} />
                        </TableCell>
                        <TableCell className="font-medium py-2 px-2 sm:px-4">{record.title}</TableCell>
                        <TableCell className="py-2 px-2 sm:px-4">{record.artist}</TableCell>
                        <TableCell className="py-2 px-2 sm:px-4">
                           {record.barcode && inventoryBarcodes.has(record.barcode) ? <Check className="h-5 w-5 text-primary"/> : '-'}
                        </TableCell>
                        <TableCell className="text-right py-2 px-1 sm:pr-4">
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
              <h3 className="mt-4 text-xl font-semibold text-foreground">Your Wishlist is Empty</h3>
              <p className="mt-2 text-muted-foreground">
                {searchTerm ? "No results found for your search." : "Scan a record or add one manually to start building your wishlist!"}
              </p>
              <Button asChild className="mt-6 bg-accent hover:bg-accent/90 text-accent-foreground"><Link href="/scan"><span className="flex items-center gap-2"><PlusCircle className="mr-2 h-5 w-5" /> Add to Wishlist</span></Link></Button>
            </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

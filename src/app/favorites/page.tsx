
"use client";
import ProtectedRoute from "@/components/layout/protected-route";
import RecordCard from "@/components/records/record-card";
import { Button } from "@/components/ui/button";
import type { VinylRecord } from "@/types";
import { Heart, Loader2, Music2, AlertTriangle, ArrowLeft } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getRecordById, getInventoryBarcodes } from "@/services/record-service";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";


export default function FavoritesPage() {
  const { user, loading: authLoading, toggleFavorite, activeDistributorId } = useAuth();
  const [favoriteRecords, setFavoriteRecords] = useState<VinylRecord[]>([]);
  const [inventoryBarcodes, setInventoryBarcodes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user && user.role !== 'viewer') {
      router.replace('/dashboard'); // Redirect non-clients
    }
  }, [user, authLoading, router]);

  const fetchFavoriteRecords = useCallback(async () => {
    if (!user || !user.favorites || user.favorites.length === 0) {
      setFavoriteRecords([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const recordPromises = user.favorites.map(id => getRecordById(id));
      const [results, fetchedInventoryBarcodes] = await Promise.all([
        Promise.allSettled(recordPromises), // Use allSettled to avoid failing all if one fails
        getInventoryBarcodes(user, activeDistributorId)
      ]);

      const validRecords = results
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => (result as PromiseFulfilledResult<VinylRecord>).value);
      
      setFavoriteRecords(validRecords);
      setInventoryBarcodes(new Set(fetchedInventoryBarcodes));

    } catch (error) {
      console.error("FavoritesPage: Failed to fetch favorite records:", error);
      toast({
        title: "Error Loading Favorites",
        description: "Could not load your favorite records. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, activeDistributorId]);


  useEffect(() => {
    if (!authLoading && user && user.role === 'viewer') {
      fetchFavoriteRecords();
    } else if (!authLoading && user && user.role !== 'viewer') {
      setIsLoading(false); // Not a client, stop loading
    }
  }, [authLoading, user, fetchFavoriteRecords]);


  const handleToggleFavorite = async (recordId: string) => {
    await toggleFavorite(recordId);
    // Optimistically remove the record from the local state after unfavoriting
    setFavoriteRecords(prev => prev.filter(r => r.id !== recordId));
  };

  if (authLoading || isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="ml-3 text-lg">{authLoading ? "Loading user..." : "Loading favorites..."}</p>
        </div>
      </ProtectedRoute>
    );
  }

  if (user && user.role !== 'viewer') {
     return (
        <ProtectedRoute>
          <div className="flex flex-col items-center justify-center text-center p-6">
            <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
            <p className="text-muted-foreground mt-2">This page is for clients only.</p>
            <Button onClick={() => router.push('/dashboard')} className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
            </Button>
          </div>
        </ProtectedRoute>
    );
  }


  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Heart className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight text-foreground">My Favorites</h2>
        </div>

        {favoriteRecords.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {favoriteRecords.map((record) => (
              <RecordCard 
                key={record.id} 
                record={record}
                isOperator={false}
                isFavorite={true} // All records here are favorites
                onToggleFavorite={() => handleToggleFavorite(record.id)}
                isInInventory={record.barcode ? inventoryBarcodes.has(record.barcode) : record.isInventoryItem}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Music2 className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 text-xl font-semibold text-foreground">No Favorites Yet</h3>
            <p className="mt-2 text-muted-foreground">
              Browse the main inventory and add records to your favorites.
            </p>
            <Button asChild className="mt-6">
              <Link href="/inventory">
                <span className="flex items-center gap-2">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Browse Inventory
                </span>
              </Link>
            </Button>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

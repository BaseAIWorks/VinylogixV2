"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { getDistributorById } from "@/services/distributor-service";
import { getInventoryRecords } from "@/services/record-service";
import type { Distributor, VinylRecord, SortOption } from "@/types";
import type { DocumentSnapshot } from "firebase/firestore";
import { Loader2, ArrowLeft, Store, AlertTriangle, Search, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RecordCard from "@/components/records/record-card";
import CompactRecordCard from "@/components/records/compact-record-card";
import Link from "next/link";

export default function ClientViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading, clientAccessDistributors } = useAuth();
  const { toast } = useToast();
  const distributorId = params.distributorId as string;

  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [records, setRecords] = useState<VinylRecord[]>([]);
  const [isLoadingDistributor, setIsLoadingDistributor] = useState(true);
  const [isFetching, setIsFetching] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

  const observerRef = useRef<HTMLDivElement | null>(null);

  // Verify access
  const hasAccess = clientAccessDistributors.some(d => d.id === distributorId);

  useEffect(() => {
    async function loadDistributor() {
      if (!distributorId) return;
      setIsLoadingDistributor(true);
      try {
        const dist = await getDistributorById(distributorId);
        setDistributor(dist);
      } catch (error) {
        toast({ title: "Error", description: "Could not load distributor details.", variant: "destructive" });
      } finally {
        setIsLoadingDistributor(false);
      }
    }
    loadDistributor();
  }, [distributorId, toast]);

  const fetchRecords = useCallback(async (loadMore = false) => {
    if (!user || !distributorId || !hasAccess) {
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
        distributorId,
        filters: {},
        sortOption: "added_at_desc" as SortOption,
        limit: 25,
        lastVisible: loadMore ? lastVisible : null,
      });

      setRecords(loadMore ? [...records, ...fetchedRecords] : fetchedRecords);
      setLastVisible(newLastVisible);
      setHasMore(fetchedRecords.length === 25);
    } catch (error) {
      toast({ title: "Error", description: "Could not load catalog.", variant: "destructive" });
    } finally {
      setIsFetching(false);
      setIsFetchingMore(false);
    }
  }, [user, distributorId, hasAccess, isFetchingMore, hasMore, lastVisible, records, toast]);

  useEffect(() => {
    if (!authLoading && user && hasAccess) {
      fetchRecords();
    }
  }, [authLoading, user, hasAccess, distributorId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          fetchRecords(true);
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, fetchRecords]);

  // Filter records by search term
  const filteredRecords = records.filter(record => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      record.title?.toLowerCase().includes(search) ||
      record.artist?.toLowerCase().includes(search) ||
      record.label?.toLowerCase().includes(search)
    );
  });

  if (authLoading || isLoadingDistributor) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You do not have client access to this distributor.</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>{distributor?.companyName || distributor?.name || "Catalog"}</CardTitle>
              <p className="text-sm text-muted-foreground">Browsing as a client</p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'compact' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('compact')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isFetching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">No records found.</p>
              {searchTerm && <p className="text-sm">Try adjusting your search term.</p>}
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredRecords.map((record) => (
                    <RecordCard
                      key={record.id}
                      record={record}
                      isOperator={false}
                      isInInventory={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRecords.map((record) => (
                    <CompactRecordCard
                      key={record.id}
                      record={record}
                      isOperator={false}
                    />
                  ))}
                </div>
              )}

              {/* Infinite scroll trigger */}
              <div ref={observerRef} className="h-10 flex items-center justify-center">
                {isFetchingMore && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

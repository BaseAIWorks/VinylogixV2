"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, LayoutGrid, List, Loader2, CheckCircle2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import PublicRecordCard, { type PublicRecord } from "./public-record-card";
import type { CardDisplaySettings, StorefrontSettings } from "@/types";
import { formatPriceForDisplay } from "@/lib/utils";
import { auth } from "@/lib/firebase";

interface StorefrontCatalogProps {
  distributorId: string;
  slug: string;
  storefrontSettings?: StorefrontSettings;
  cardDisplaySettings?: CardDisplaySettings;
  initialRecords?: PublicRecord[];
  initialHasMore?: boolean;
  initialNextCursor?: string | null;
  initialIsApprovedClient?: boolean;
}

export default function StorefrontCatalog({
  distributorId,
  slug,
  storefrontSettings,
  cardDisplaySettings,
  initialRecords = [],
  initialHasMore = false,
  initialNextCursor = null,
  initialIsApprovedClient = false,
}: StorefrontCatalogProps) {
  const { user, addToCart } = useAuth();
  const { toast } = useToast();

  const [records, setRecords] = useState<PublicRecord[]>(initialRecords);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sending' | 'sent' | 'already_pending'>('idle');
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [isApprovedClient, setIsApprovedClient] = useState(initialIsApprovedClient);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>(
    storefrontSettings?.catalogLayout || 'grid'
  );
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const getAuthHeader = useCallback(async (): Promise<Record<string, string>> => {
    const currentUser = auth.currentUser;
    if (!currentUser) return {};
    try {
      const token = await currentUser.getIdToken();
      return { Authorization: `Bearer ${token}` };
    } catch {
      return {};
    }
  }, []);

  const fetchRecords = useCallback(async (loadMore = false) => {
    if (loadMore && (!hasMore || isLoadingMore)) return;

    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.set('limit', '25');
      if (loadMore && nextCursor) params.set('cursor', nextCursor);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (activeGenre) params.set('genre', activeGenre);

      const headers = await getAuthHeader();
      const res = await fetch(`/api/storefront/${slug}/catalog?${params}`, { headers });

      if (!res.ok) return;

      const data = await res.json();
      setRecords(loadMore ? (prev) => [...prev, ...data.records] : data.records);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
      setIsApprovedClient(data.isApprovedClient);
    } catch (error) {
      console.error('Error fetching catalog:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [slug, debouncedSearch, activeGenre, hasMore, nextCursor, isLoadingMore, getAuthHeader]);

  // Refetch when search/filter changes
  useEffect(() => {
    fetchRecords(false);
  }, [debouncedSearch, activeGenre]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when user auth state changes (e.g., login)
  useEffect(() => {
    fetchRecords(false);
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          fetchRecords(true);
        }
      },
      { threshold: 0.1 }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, fetchRecords]);

  const handleAddToCart = (recordId: string) => {
    if (!user || !addToCart) return;
    const publicRecord = records.find((r) => r.id === recordId);
    if (!publicRecord || publicRecord.sellingPrice == null) return;

    // Construct a minimal VinylRecord-shaped object from public data
    // to avoid fetching the full document (which includes operator-only fields)
    const recordForCart = {
      id: publicRecord.id,
      title: publicRecord.title || '',
      artist: publicRecord.artist || '',
      cover_url: publicRecord.cover_url,
      sellingPrice: publicRecord.sellingPrice,
      media_condition: publicRecord.media_condition || '',
      sleeve_condition: publicRecord.sleeve_condition || '',
      formatDetails: publicRecord.formatDetails,
      year: publicRecord.year,
      label: publicRecord.label,
      genre: publicRecord.genre,
      distributorId,
      isInventoryItem: true,
      ownerUid: '',
      added_at: '',
    } as any;

    addToCart(recordForCart, 1, distributorId);
  };

  const handleRequestAccess = async () => {
    if (!user || requestStatus !== 'idle') return;
    setRequestStatus('sending');
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/storefront/${slug}/request-access`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (res.ok) {
        setRequestStatus('sent');
        toast({ title: "Request sent", description: "The distributor will review your access request." });
      } else if (res.status === 409) {
        setRequestStatus('already_pending');
      } else if (res.status === 400 && data.error?.includes('already have access')) {
        // User already has access — refetch to update client status
        fetchRecords(false);
      } else {
        setRequestStatus('idle');
        toast({ title: "Error", description: data.error || "Could not send request.", variant: "destructive" });
      }
    } catch {
      setRequestStatus('idle');
      toast({ title: "Error", description: "Could not send request.", variant: "destructive" });
    }
  };

  const showSearch = storefrontSettings?.showSearch !== false;
  const showGenreFilter = storefrontSettings?.showGenreFilter === true;
  const showRecordCount = storefrontSettings?.showRecordCount === true;

  // Collect unique genres from loaded records for filter
  const genres = showGenreFilter
    ? Array.from(new Set(records.flatMap((r) => r.genre || []))).sort()
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Info banner for non-clients */}
      {!isApprovedClient && (
        <div className="mb-6 rounded-lg border bg-muted/50 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {user
              ? "You're browsing as a visitor. Request access to see prices and place orders."
              : "Register or sign in to request access, see prices, and place orders."}
          </p>
          {user && (
            <div className="mt-3">
              {requestStatus === 'sent' || requestStatus === 'already_pending' ? (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Access request sent — waiting for approval
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={handleRequestAccess}
                  disabled={requestStatus === 'sending'}
                >
                  {requestStatus === 'sending' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Request Access
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search & filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        {showSearch && (
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search records..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          {showGenreFilter && genres.length > 0 && (
            <select
              value={activeGenre || ''}
              onChange={(e) => setActiveGenre(e.target.value || null)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All Genres</option>
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          )}
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

      {showRecordCount && !isLoading && (
        <p className="mb-4 text-sm text-muted-foreground">
          {records.length} record{records.length !== 1 ? 's' : ''} available
        </p>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : records.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-lg">No records found.</p>
          {searchTerm && <p className="text-sm">Try a different search term.</p>}
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {records.map((record) => (
                <PublicRecordCard
                  key={record.id}
                  record={record}
                  cardDisplaySettings={cardDisplaySettings}
                  isApprovedClient={isApprovedClient}
                  onAddToCart={isApprovedClient ? handleAddToCart : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                    {record.cover_url ? (
                      <img
                        src={record.cover_url}
                        alt={record.title || ''}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/30">
                        &#9834;
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{record.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{record.artist}</p>
                  </div>
                  {record.year && (
                    <span className="hidden text-xs text-muted-foreground sm:inline">{record.year}</span>
                  )}
                  {isApprovedClient && record.sellingPrice != null && (
                    <span className="text-sm font-semibold text-primary">
                      &euro;{formatPriceForDisplay(record.sellingPrice)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Infinite scroll trigger */}
          <div ref={observerRef} className="flex h-10 items-center justify-center">
            {isLoadingMore && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
          </div>
        </>
      )}
    </div>
  );
}


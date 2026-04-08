"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, LayoutGrid, List, Loader2, CheckCircle2, Send, SlidersHorizontal, X, ArrowUpDown, Euro, Disc3, SearchX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import PublicRecordCard, { type PublicRecord } from "./public-record-card";
import RecordDetailModal from "./record-detail-modal";
import type { CardDisplaySettings, StorefrontSettings } from "@/types";
import { formatPriceForDisplay } from "@/lib/utils";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";

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

type SortOption = 'newest' | 'artist_asc' | 'artist_desc' | 'year_new' | 'year_old';

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
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>(storefrontSettings?.catalogLayout || 'grid');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [selectedRecord, setSelectedRecord] = useState<PublicRecord | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Refs for stable callback
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const nextCursorRef = useRef(nextCursor);
  nextCursorRef.current = nextCursor;
  const isLoadingMoreRef = useRef(isLoadingMore);
  isLoadingMoreRef.current = isLoadingMore;

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
    } catch { return {}; }
  }, []);

  const fetchRecords = useCallback(async (loadMore = false) => {
    if (loadMore && (!hasMoreRef.current || isLoadingMoreRef.current)) return;
    if (loadMore) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams();
      params.set('limit', '25');
      if (loadMore && nextCursorRef.current) params.set('cursor', nextCursorRef.current);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (activeGenre) params.set('genre', activeGenre);
      if (activeFormat) params.set('format', activeFormat);

      const headers = await getAuthHeader();
      const res = await fetch(`/api/storefront/${slug}/catalog?${params}`, { headers });
      if (!res.ok) return;

      const data = await res.json();
      let fetched: PublicRecord[] = data.records;

      // Client-side sort (server returns by added_at desc)
      if (sortOption !== 'newest') {
        fetched = sortRecords(fetched, sortOption);
      }

      setRecords(loadMore ? (prev) => [...prev, ...fetched] : fetched);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
      setIsApprovedClient(data.isApprovedClient);
    } catch (error) {
      console.error('Error fetching catalog:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [slug, debouncedSearch, activeGenre, activeFormat, sortOption, getAuthHeader]);

  useEffect(() => { fetchRecords(false); }, [fetchRecords, user?.uid]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) fetchRecords(true);
      },
      { threshold: 0.1 }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, isLoading, fetchRecords]);

  const handleAddToCart = (recordId: string) => {
    if (!user || !addToCart) return;
    const r = records.find((rec) => rec.id === recordId);
    if (!r || r.sellingPrice == null) return;
    addToCart({
      id: r.id, title: r.title || '', artist: r.artist || '', cover_url: r.cover_url,
      sellingPrice: r.sellingPrice, media_condition: r.media_condition || '',
      sleeve_condition: r.sleeve_condition || '', formatDetails: r.formatDetails,
      year: r.year, label: r.label, genre: r.genre,
      distributorId, isInventoryItem: true, ownerUid: '', added_at: '',
    } as any, 1, distributorId);
  };

  const handleRequestAccess = async () => {
    if (!user || requestStatus !== 'idle') return;
    setRequestStatus('sending');
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/storefront/${slug}/request-access`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) { setRequestStatus('sent'); toast({ title: "Request sent", description: "The distributor will review your access request." }); }
      else if (res.status === 409) setRequestStatus('already_pending');
      else if (res.status === 400 && data.error?.includes('already have access')) fetchRecords(false);
      else { setRequestStatus('idle'); toast({ title: "Error", description: data.error || "Could not send request.", variant: "destructive" }); }
    } catch { setRequestStatus('idle'); toast({ title: "Error", description: "Could not send request.", variant: "destructive" }); }
  };

  const showSearch = storefrontSettings?.showSearch !== false;
  const showGenreFilter = storefrontSettings?.showGenreFilter !== false;
  const showFormatFilter = storefrontSettings?.showFormatFilter !== false;

  const genres = Array.from(new Set(records.flatMap((r) => r.genre || []))).sort();
  const formats = Array.from(new Set(records.map((r) => r.formatDetails).filter(Boolean) as string[])).sort();
  const hasActiveFilters = !!activeGenre || !!activeFormat;

  const clearAllFilters = () => { setActiveGenre(null); setActiveFormat(null); };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Access banner */}
      {!isApprovedClient && (
        <div className="mb-6 rounded-xl border bg-muted/30 p-4 text-center">
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
                <Button size="sm" onClick={handleRequestAccess} disabled={requestStatus === 'sending'}>
                  {requestStatus === 'sending' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Request Access
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Toolbar */}
      <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {/* Search */}
          {showSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by title, artist, or label..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-8"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Sort */}
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs"
            >
              <option value="newest">Newest First</option>
              <option value="artist_asc">Artist A → Z</option>
              <option value="artist_desc">Artist Z → A</option>
              <option value="year_new">Year (Newest)</option>
              <option value="year_old">Year (Oldest)</option>
            </select>

            {/* Filter toggle */}
            {(showGenreFilter || showFormatFilter) && (
              <Button
                variant={showFilters || hasActiveFilters ? "default" : "outline"}
                size="sm"
                className="h-9"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                Filters
                {hasActiveFilters && (
                  <Badge className="ml-1.5 h-4 w-4 rounded-full p-0 text-[9px]">
                    {(activeGenre ? 1 : 0) + (activeFormat ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            )}

            {/* View toggles */}
            <div className="flex rounded-md border">
              <button
                onClick={() => setViewMode('grid')}
                className={cn("p-2 transition-colors", viewMode === 'grid' ? "bg-muted" : "hover:bg-muted/50")}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={cn("p-2 transition-colors border-l", viewMode === 'compact' ? "bg-muted" : "hover:bg-muted/50")}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
            {showGenreFilter && genres.length > 0 && (
              <select
                value={activeGenre || ''}
                onChange={(e) => setActiveGenre(e.target.value || null)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">All Genres</option>
                {genres.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            )}
            {showFormatFilter && formats.length > 0 && (
              <select
                value={activeFormat || ''}
                onChange={(e) => setActiveFormat(e.target.value || null)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">All Formats</option>
                {formats.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAllFilters}>
                <X className="mr-1 h-3 w-3" />
                Clear filters
              </Button>
            )}
          </div>
        )}

        {/* Active filter pills */}
        {hasActiveFilters && !showFilters && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeGenre && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {activeGenre}
                <button onClick={() => setActiveGenre(null)}><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {activeFormat && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {activeFormat}
                <button onClick={() => setActiveFormat(null)}><X className="h-3 w-3" /></button>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        // Skeleton loading
        viewMode === 'grid' ? (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="space-y-2.5">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
                <Skeleton className="h-14 w-14 shrink-0 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        )
      ) : records.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <SearchX className="h-12 w-12 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-medium">
            {searchTerm ? `No records match "${searchTerm}"` : hasActiveFilters ? "No records in this category" : "This catalog is being set up"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchTerm ? "Try a different search term or clear your search." : hasActiveFilters ? "Try removing some filters." : "Check back soon for new additions."}
          </p>
          {(searchTerm || hasActiveFilters) && (
            <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearchTerm(""); clearAllFilters(); }}>
              Clear all filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {records.map((record) => (
                <PublicRecordCard
                  key={record.id}
                  record={record}
                  cardDisplaySettings={cardDisplaySettings}
                  isApprovedClient={isApprovedClient}
                  onAddToCart={isApprovedClient ? handleAddToCart : undefined}
                  onClick={setSelectedRecord}
                />
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-1">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="group flex cursor-pointer items-center gap-4 rounded-lg border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/30"
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {record.cover_url ? (
                      <img src={record.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/20 text-lg">&#9834;</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">{record.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{record.artist}</p>
                  </div>
                  <div className="hidden items-center gap-4 text-xs text-muted-foreground sm:flex">
                    {record.year && <span>{record.year}</span>}
                    {record.formatDetails && <span className="hidden md:inline">{record.formatDetails}</span>}
                    {record.media_condition && <span className="hidden lg:inline">{record.media_condition}</span>}
                  </div>
                  {isApprovedClient && record.sellingPrice != null && (
                    <span className="shrink-0 text-sm font-semibold text-primary">
                      &euro;{formatPriceForDisplay(record.sellingPrice)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Infinite scroll */}
          <div ref={observerRef} className="flex h-10 items-center justify-center">
            {isLoadingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        </>
      )}

      {/* Detail modal */}
      <RecordDetailModal
        record={selectedRecord}
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        isApprovedClient={isApprovedClient}
        onAddToCart={isApprovedClient ? handleAddToCart : undefined}
      />
    </div>
  );
}

function sortRecords(records: PublicRecord[], sort: SortOption): PublicRecord[] {
  return [...records].sort((a, b) => {
    switch (sort) {
      case 'artist_asc': return (a.artist || '').localeCompare(b.artist || '');
      case 'artist_desc': return (b.artist || '').localeCompare(a.artist || '');
      case 'year_new': return (b.year || 0) - (a.year || 0);
      case 'year_old': return (a.year || 0) - (b.year || 0);
      default: return 0;
    }
  });
}

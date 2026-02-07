
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RecordForm, { createFormDefaults, RecordFormValues, RecordFormInputData } from '@/components/records/record-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, AlertTriangle, Disc3, Barcode, Search, Edit3, Keyboard, CheckCircle2, Music2, Info, ChevronDown, ChevronUp, Calendar, Tag, Users, TrendingUp, Euro, ShoppingCart, Heart, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { addRecord } from '@/services/record-service';
import type { VinylRecord, Track } from '@/types';
import { prepareRecord } from '@/ai/flows/prepare-record-flow';
import Image from "next/image";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type EntrySource = 'manual' | 'barcode' | 'discogs';

const SourceBadge = ({ source }: { source: EntrySource }) => {
  const config = {
    manual: { icon: Edit3, label: 'Manual Entry', className: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800' },
    barcode: { icon: Barcode, label: 'Barcode Scan', className: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800' },
    discogs: { icon: Search, label: 'Discogs Import', className: 'bg-orange-500/10 text-orange-600 border-orange-200 dark:border-orange-800' },
  };
  const { icon: Icon, label, className } = config[source];

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Badge>
  );
};

const KeyboardShortcutsHelp = () => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Keyboard className="h-4 w-4" />
          <span className="hidden sm:inline">Shortcuts</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-2 p-1">
          <p className="font-semibold text-sm">Keyboard Shortcuts</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Go back</span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Save record</span>
              <div className="flex gap-0.5">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘</kbd>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">S</kbd>
              </div>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Save & scan next</span>
              <div className="flex gap-0.5">
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⌘</kbd>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">⇧</kbd>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">S</kbd>
              </div>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const TracklistPreview = ({ tracklist }: { tracklist: Track[] }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!tracklist || tracklist.length === 0) return null;

  const displayTracks = isOpen ? tracklist : tracklist.slice(0, 4);
  const hasMore = tracklist.length > 4;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="mt-4 pt-4 border-t">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full text-left group">
            <Music2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Tracklist</span>
            <Badge variant="secondary" className="text-xs">{tracklist.length} tracks</Badge>
            <span className="flex-1" />
            {hasMore && (
              isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        <div className="mt-2 space-y-1">
          {displayTracks.map((track, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs py-1">
              <span className="w-6 text-muted-foreground font-mono">{track.position || (idx + 1)}</span>
              <span className="flex-1 truncate">{track.title}</span>
              {track.duration && <span className="text-muted-foreground">{track.duration}</span>}
            </div>
          ))}
        </div>
        <CollapsibleContent>
          <div className="space-y-1">
            {tracklist.slice(4).map((track, idx) => (
              <div key={idx + 4} className="flex items-center gap-2 text-xs py-1">
                <span className="w-6 text-muted-foreground font-mono">{track.position || (idx + 5)}</span>
                <span className="flex-1 truncate">{track.title}</span>
                {track.duration && <span className="text-muted-foreground">{track.duration}</span>}
              </div>
            ))}
          </div>
        </CollapsibleContent>
        {hasMore && !isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="text-xs text-primary hover:underline mt-1"
          >
            Show all {tracklist.length} tracks
          </button>
        )}
      </div>
    </Collapsible>
  );
};

const LoadingSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-1/3">
        <div className="aspect-square bg-muted rounded-lg" />
      </div>
      <div className="lg:w-2/3 space-y-4">
        <div className="h-8 bg-muted rounded w-3/4" />
        <div className="h-6 bg-muted rounded w-1/2" />
        <div className="grid grid-cols-2 gap-4 mt-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-5 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
    <div className="h-px bg-muted" />
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-muted rounded" />
      ))}
    </div>
  </div>
);

export default function AddRecordPage() {
  const { user, activeDistributor } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<RecordFormInputData>(() => {
    const barcode = searchParams.get('barcode');
    const artist = searchParams.get('artist');
    const title = searchParams.get('title');
    const defaults = createFormDefaults();
    if (barcode) defaults.barcode = barcode;
    if (artist) defaults.artist = artist;
    if (title) defaults.title = title;
    return defaults;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formRef, setFormRef] = useState<HTMLFormElement | null>(null);

  // Determine entry source
  const getEntrySource = useCallback((): EntrySource => {
    if (searchParams.get('discogs_id')) return 'discogs';
    if (searchParams.get('barcode')) return 'barcode';
    return 'manual';
  }, [searchParams]);

  const entrySource = getEntrySource();

  const fetchInitialRecordData = useCallback(async () => {
    if (!user || !activeDistributor) return;

    const discogsIdParam = searchParams.get('discogs_id');
    const discogsId = discogsIdParam ? parseInt(discogsIdParam, 10) : undefined;

    if (!discogsId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await prepareRecord({
          discogsId: discogsId,
          distributorId: activeDistributor.id,
          allowAiFeatures: activeDistributor.subscription?.allowAiFeatures || false,
      });

      if (result) {
        setInitialData(createFormDefaults(result));
      } else {
        throw new Error("Could not prepare record data.");
      }
    } catch (e: any) {
      console.error("Error preparing record:", e);
      setError(`Error fetching record details: ${e.message}`);
      toast({
        title: "Error Loading Details",
        description: e.message || "An unknown error occurred while fetching details from Discogs.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchParams, user, activeDistributor, toast]);

  useEffect(() => {
    fetchInitialRecordData();
  }, [fetchInitialRecordData]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to go back
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        router.back();
        return;
      }

      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (formRef && !isSubmitting) {
          // Trigger form submission
          const submitButton = formRef.querySelector('button[type="submit"]') as HTMLButtonElement;
          if (submitButton) submitButton.click();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, isSubmitting, formRef]);

  const handleSubmit = async (values: RecordFormValues, andScanNext: boolean = false) => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const recordData = {
      ...initialData,
      ...values,
      discogs_id: initialData.discogs_id,
      barcode: initialData.barcode,
      dataAiHint: initialData.dataAiHint,
      cover_url: values.cover_url,
      tracklist: initialData.tracklist,
      artistBio: initialData.artistBio,
      albumInfo: initialData.albumInfo,
    };

    try {
      const newRecord = await addRecord(recordData, user);
      toast({
        title: "Record Added",
        description: `"${values.title}" has been successfully added to your inventory.`,
      });
      if (andScanNext) {
        router.push('/scan');
      } else {
        router.push(`/records/${newRecord.id}`);
      }
    } catch (error: any) {
      toast({
        title: "Error Adding Record",
        description: error.message || "An unknown error occurred.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button onClick={() => router.back()} variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Add New Record</h1>
              <SourceBadge source={entrySource} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {entrySource === 'discogs' && 'Pre-filled from Discogs. Review and complete the details.'}
              {entrySource === 'barcode' && 'Scanned from barcode. Add the remaining details.'}
              {entrySource === 'manual' && 'Enter the record details manually.'}
            </p>
          </div>
        </div>
        <KeyboardShortcutsHelp />
      </div>

      {/* Main Content */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6">
              <LoadingSkeleton />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-full bg-destructive/10 p-4 mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-destructive">Could not load record details</h3>
              <p className="mt-2 text-muted-foreground max-w-md">{error}</p>
              <div className="flex gap-2 mt-6">
                <Button variant="outline" onClick={() => router.back()}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
                <Button onClick={fetchInitialRecordData}>
                  Try Again
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row">
              {/* Sidebar with album art - sticky on desktop */}
              {initialData?.discogs_id && (
                <div className="lg:w-80 xl:w-96 bg-muted/30 border-b lg:border-b-0 lg:border-r">
                  <div className="p-6 lg:sticky lg:top-6">
                    <div className="aspect-square relative rounded-lg overflow-hidden shadow-lg">
                      <Image
                        src={initialData?.cover_url || `https://placehold.co/400x400.png`}
                        alt={`${initialData?.title || 'Record'} cover`}
                        fill
                        className="object-cover"
                        data-ai-hint={initialData?.dataAiHint || "album cover"}
                        unoptimized={!!initialData?.cover_url?.includes('discogs.com')}
                      />
                    </div>

                    {/* Album info */}
                    <div className="mt-4 space-y-1">
                      <h2 className="text-xl font-bold text-foreground truncate" title={initialData?.title}>
                        {initialData?.title}
                      </h2>
                      <p className="text-base text-muted-foreground truncate" title={initialData?.artist}>
                        {initialData?.artist}
                      </p>
                    </div>

                    {/* Release Details */}
                    <div className="mt-4 space-y-2 text-sm">
                      {initialData?.releasedDate && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Released: <span className="text-foreground">{initialData.releasedDate}</span></span>
                        </div>
                      )}
                      {!initialData?.releasedDate && initialData?.year && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Year: <span className="text-foreground">{initialData.year}</span></span>
                        </div>
                      )}
                      {initialData?.label && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Tag className="h-3.5 w-3.5" />
                          <span className="truncate">Label: <span className="text-foreground">{initialData.label}</span></span>
                        </div>
                      )}
                      {initialData?.country && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="w-3.5 text-center">🌍</span>
                          <span>Country: <span className="text-foreground">{initialData.country}</span></span>
                        </div>
                      )}
                      {initialData?.formatDetails && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Disc3 className="h-3.5 w-3.5" />
                          <span className="truncate">Format: <span className="text-foreground">{initialData.formatDetails}</span></span>
                        </div>
                      )}
                    </div>

                    {/* Genre tags */}
                    {initialData?.genre && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground mb-1.5">Genre</p>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(initialData.genre) ? initialData.genre : initialData.genre?.split(', ')).map((g, i) => (
                            <Badge key={`genre-${i}`} variant="secondary" className="text-xs">
                              {g}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Style tags */}
                    {initialData?.style && (
                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1.5">Style</p>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(initialData.style) ? initialData.style : initialData.style?.split(', ')).map((s, i) => (
                            <Badge key={`style-${i}`} variant="outline" className="text-xs bg-primary/5">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Discogs Community Stats */}
                    {initialData?.discogsCommunity && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Discogs Community</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-1.5 text-sm">
                            <Users className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-muted-foreground">Have:</span>
                            <span className="font-medium">{initialData.discogsCommunity.have?.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Heart className="h-3.5 w-3.5 text-red-500" />
                            <span className="text-muted-foreground">Want:</span>
                            <span className="font-medium">{initialData.discogsCommunity.want?.toLocaleString()}</span>
                          </div>
                          {initialData.discogsCommunity.rating?.average && (
                            <div className="col-span-2 flex items-center gap-1.5 text-sm">
                              <Star className="h-3.5 w-3.5 text-yellow-500" />
                              <span className="text-muted-foreground">Rating:</span>
                              <span className="font-medium">{initialData.discogsCommunity.rating.average.toFixed(1)}/5</span>
                              <span className="text-xs text-muted-foreground">({initialData.discogsCommunity.rating.count} votes)</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Marketplace Stats */}
                    {initialData?.discogsMarketplace && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-muted-foreground mb-2">Marketplace</p>
                        <div className="space-y-2">
                          {initialData.discogsMarketplace.medianPrice && (
                            <div className="flex items-center justify-between bg-green-500/10 rounded-md px-3 py-2">
                              <div className="flex items-center gap-1.5 text-sm">
                                <TrendingUp className="h-4 w-4 text-green-600" />
                                <span className="text-muted-foreground">Median Price</span>
                              </div>
                              <span className="font-semibold text-green-600">
                                {initialData.discogsMarketplace.medianPrice.currency === 'EUR' ? '€' : initialData.discogsMarketplace.medianPrice.currency}
                                {initialData.discogsMarketplace.medianPrice.value.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {initialData.discogsMarketplace.lowestPrice && (
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-1.5">
                                <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Lowest</span>
                              </div>
                              <span className="font-medium">
                                {initialData.discogsMarketplace.lowestPrice.currency === 'EUR' ? '€' : initialData.discogsMarketplace.lowestPrice.currency}
                                {initialData.discogsMarketplace.lowestPrice.value.toFixed(2)}
                              </span>
                            </div>
                          )}
                          {initialData.discogsMarketplace.numForSale !== undefined && (
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-1.5">
                                <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">For Sale</span>
                              </div>
                              <span className="font-medium">{initialData.discogsMarketplace.numForSale} copies</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Discogs link */}
                    {initialData?.discogs_id && (
                      <div className="mt-4 pt-4 border-t">
                        <a
                          href={`https://www.discogs.com/release/${initialData.discogs_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors"
                        >
                          <Disc3 className="h-3.5 w-3.5" />
                          View on Discogs
                          <span className="font-mono">#{initialData.discogs_id}</span>
                        </a>
                      </div>
                    )}

                    {/* Tracklist */}
                    {initialData?.tracklist && initialData.tracklist.length > 0 && (
                      <TracklistPreview tracklist={initialData.tracklist} />
                    )}
                  </div>
                </div>
              )}

              {/* Form */}
              <div className="flex-1 p-6">
                <RecordForm
                  initialData={initialData}
                  onSubmitForm={handleSubmit}
                  onSubmitAndScanNext={(values) => handleSubmit(values, true)}
                  isSubmittingForm={isSubmitting}
                  user={user!}
                  submitButtonText="Add Record to Inventory"
                  disableDiscogsFields={!!initialData.discogs_id}
                  hideDiscogsPreview={!!initialData.discogs_id}
                  shelfLocations={activeDistributor?.shelfLocations}
                  storageLocations={activeDistributor?.storageLocations}
                  suppliers={activeDistributor?.suppliers}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t lg:hidden z-50">
        <div className="flex gap-2 max-w-screen-xl mx-auto">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-accent hover:bg-accent/90"
            disabled={isSubmitting || isLoading}
            onClick={() => {
              const form = document.querySelector('form');
              if (form) {
                const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                if (submitButton) submitButton.click();
              }
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Add Record
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

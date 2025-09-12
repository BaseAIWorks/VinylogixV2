
"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { VinylRecord, DiscogsMarketplaceStats, Track } from "@/types";
import { ArrowLeft, Edit, Trash2, CalendarDays, Tag, Music, Layers3, Info, Euro, Package, MapPin, AlignLeft, Barcode, Disc3, Loader2, User, Heart, Scale, ListMusic, ExternalLink, Library, PlusCircle, ListChecks, Sparkles, UserCircle, RefreshCw, ShoppingCart, Minus, Plus, Warehouse, Store, Check, BarChart3, AlertTriangle, Users, Star, TrendingDown, Briefcase, Globe, Paintbrush, X, Weight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState, useCallback, useMemo } from "react";
import { format } from 'date-fns';
import { getRecordById as fetchRecordById, deleteRecord as deleteRecordFromService, addRecord as saveRecordToService, updateRecord as updateRecordInService, adjustStock, getWishlistRecord } from "@/services/record-service";
import { getDiscogsReleaseDetailsById, getDiscogsMarketplaceStats } from "@/services/discogs-service";
import { useAuth } from "@/hooks/use-auth";
import { formatPriceForDisplay } from "@/lib/utils";
import { createFormDefaults } from "@/components/records/record-form";
import { generateRecordInfo } from "@/ai/flows/generate-record-info-flow";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";


const DetailItem = ({ icon: Icon, label, value, isDate = false, isCurrency = false }: { icon: React.ElementType, label: string, value?: string | number | string[] | React.ReactNode | null, isDate?: boolean, isCurrency?: boolean }) => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return null;
  
  let displayValue: string | number | React.ReactNode;
  if (React.isValidElement(value)) {
    displayValue = value;
  } else if (Array.isArray(value)) {
    displayValue = value.join(', ');
  } else if (isDate && typeof value === 'string') {
    try {
      displayValue = format(new Date(value), 'PPP'); 
    } catch {
      displayValue = value; 
    }
  } else if (isCurrency && (typeof value === 'number' || typeof value === 'string')) {
    const numValue = typeof value === 'string' ? parseFloat(String(value).replace(",", ".")) : Number(value);
    if (!isNaN(numValue)) {
      displayValue = `€${formatPriceForDisplay(numValue)}`;
    } else {
      displayValue = value; 
    }
  }
   else {
    displayValue = value;
  }

  return (
    <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
        <div className="flex flex-col">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="text-sm font-medium text-foreground break-words">{displayValue}</div>
        </div>
    </div>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
    <h3 className="text-lg font-semibold text-primary tracking-tight border-b pb-2 mb-4 mt-6 first:mt-0">{title}</h3>
);

const StatBox = ({ label, value, icon: Icon, subtext, isCurrency }: { label: string, value: string | number, icon: React.ElementType, subtext?: string, isCurrency?: boolean }) => (
    <div className="flex flex-col items-center justify-center p-4 border rounded-lg bg-muted/50">
        <Icon className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold text-primary">{isCurrency ? `€${formatPriceForDisplay(Number(value))}` : value}</p>
        {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
    </div>
);


export default function RecordDetailPage() {
  const { user, toggleFavorite, addToCart, activeDistributorId, activeDistributor, getDiscogsListing, updateMyDistributorSettings } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  
  const recordId = typeof params.id === 'string' ? params.id : '';
  const [record, setRecord] = useState<VinylRecord | null>(null);
  const [isLoadingRecord, setIsLoadingRecord] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmittingCollection, setIsSubmittingCollection] = useState(false);
  const [isSubmittingWishlist, setIsSubmittingWishlist] = useState(false);
  const [isGeneratingAiInfo, setIsGeneratingAiInfo] = useState(false);
  const [isReGenerating, setIsReGenerating] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [wishlistItem, setWishlistItem] = useState<VinylRecord | null>(null);
  const [isCheckingWishlist, setIsCheckingWishlist] = useState(true);
  
  const [discogsData, setDiscogsData] = useState<{
    community?: VinylRecord['discogsCommunity'];
    lastFetched: string | null;
  } | null>(null);
  const [marketStats, setMarketStats] = useState<DiscogsMarketplaceStats | null>(null);
  const [isLoadingDiscogsData, setIsLoadingDiscogsData] = useState(false);
  const [discogsError, setDiscogsError] = useState<string | null>(null);

  // State for the adjust stock dialog
  const [dialogShelfLocations, setDialogShelfLocations] = useState<string[]>([]);
  const [dialogStorageLocations, setDialogStorageLocations] = useState<string[]>([]);
  
  const isMaster = user?.role === 'master';
  const isOperator = isMaster || user?.role === 'worker';
  const canManageLocations = isMaster || (isOperator && !!user.permissions?.canManageLocations);

  const allShelfLocations = useMemo(() => {
    if (!record) return [];
    const locations = new Set<string>();
    // Handle new array format
    if (Array.isArray(record.shelf_locations)) record.shelf_locations.forEach(loc => loc && locations.add(loc.trim()));
    // Handle old string format, which might still exist in some records
    if (typeof record.shelf_location === 'string') record.shelf_location.split(',').forEach(loc => loc.trim() && locations.add(loc.trim()));
    return Array.from(locations);
  }, [record?.shelf_locations, record?.shelf_location]);

  const allStorageLocations = useMemo(() => {
    if (!record) return [];
    const locations = new Set<string>();
    // Handle new array format
    if (Array.isArray(record.storage_locations)) record.storage_locations.forEach(loc => loc && locations.add(loc.trim()));
    // Handle old string format, which might still exist in some records
    if (typeof record.storage_location === 'string') record.storage_location.split(',').forEach(loc => loc.trim() && locations.add(loc.trim()));
    return Array.from(locations);
  }, [record?.storage_locations, record?.storage_location]);

  const supplierName = useMemo(() => {
    if (!record?.supplierId || !activeDistributor?.suppliers) return null;
    return activeDistributor.suppliers.find(s => s.id === record.supplierId)?.name;
  }, [record, activeDistributor]);
  
  const discogsListing = useMemo(() => {
    if (!record || !record.discogs_id) return null;
    return getDiscogsListing(record.discogs_id);
  }, [record, getDiscogsListing]);

  useEffect(() => {
    if (searchParams.get('action') === 'adjustStock' && user && ['master', 'worker'].includes(user.role)) {
      setIsAdjustStockOpen(true);
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (isAdjustStockOpen && record) {
        setDialogShelfLocations(allShelfLocations);
        setDialogStorageLocations(allStorageLocations);
    }
  }, [isAdjustStockOpen, record, allShelfLocations, allStorageLocations]);


  useEffect(() => {
    const loadRecord = async () => {
      if (!user) return; 
      if (recordId) {
        setIsLoadingRecord(true);
        try {
          const foundRecord = await fetchRecordById(recordId);
          // Security check: ensure the record belongs to an accessible distributor or the user
          const canAccess = 
            user.role === 'superadmin' ||
            ((user.role === 'master' || user.role === 'worker') && foundRecord?.distributorId === user.distributorId) ||
            (user.role === 'viewer' && (
              (foundRecord?.ownerUid === user.uid && !foundRecord.isInventoryItem) || 
              (foundRecord?.isInventoryItem === true && user.accessibleDistributorIds?.includes(foundRecord.distributorId!))
            ));

          if (foundRecord && canAccess) {
             setRecord(foundRecord);
          } else {
            setRecord(null);
            toast({ title: "Not Found", description: "The requested record could not be found or you don't have permission to view it.", variant: "destructive" });
          }
        } catch (error) {
          console.error("Failed to fetch record:", error);
          toast({ title: "Error", description: "Could not load record details.", variant: "destructive" });
        } finally {
          setIsLoadingRecord(false);
        }
      } else {
          setIsLoadingRecord(false);
      }
    };
    if (user) loadRecord();
  }, [recordId, toast, user]);
  
  // This new useEffect checks if the current inventory record is on the user's wishlist
  useEffect(() => {
    const checkWishlist = async () => {
      if (!user || user.role !== 'viewer' || !record?.isInventoryItem || !record?.discogs_id) {
        setIsCheckingWishlist(false);
        return;
      }
      setIsCheckingWishlist(true);
      try {
        const foundItem = await getWishlistRecord(user.uid, record.discogs_id);
        setWishlistItem(foundItem);
      } catch (error) {
        console.error("Failed to check wishlist status:", error);
      } finally {
        setIsCheckingWishlist(false);
      }
    };

    if (record) {
      checkWishlist();
    }
  }, [user, record]);


  // Effect to automatically generate AI content if it's missing
  const generateAndStoreInfo = useCallback(async () => {
      if (!record || !user || !user.email || !record.artist || !record.title) return;
        
      setIsGeneratingAiInfo(true);
      try {
        const result = await generateRecordInfo({ 
            artist: record.artist, 
            title: record.title, 
            year: record.year ? Number(record.year) : undefined,
            distributorId: record.distributorId,
        });
        
        const updatedRecordData = await updateRecordInService(
          record.id,
          { artistBio: result.artistBio, albumInfo: result.albumInfo },
          user
        );

        if (updatedRecordData) {
           setRecord(updatedRecordData);
        }
      } catch (error) {
        console.error("Failed to automatically generate and store AI info:", error);
      } finally {
        setIsGeneratingAiInfo(false);
      }
    }, [record, user]);

  useEffect(() => {
    if (record && !record.artistBio && !isGeneratingAiInfo) {
      generateAndStoreInfo();
    }
  }, [record, isGeneratingAiInfo, generateAndStoreInfo]);

  const fetchDiscogsData = useCallback(async () => {
    if (!record || !record.discogs_id) return;
    setIsLoadingDiscogsData(true);
    setDiscogsError(null);
    try {
        const [discogsDetails, marketplaceData] = await Promise.all([
          getDiscogsReleaseDetailsById(record.discogs_id.toString(), record.distributorId),
          getDiscogsMarketplaceStats(record.discogs_id.toString(), record.distributorId)
        ]);

        if (discogsDetails) {
            setDiscogsData({
                community: discogsDetails.discogsCommunity,
                lastFetched: new Date().toISOString()
            });
        }
        if (marketplaceData) {
          setMarketStats(marketplaceData);
        }
    } catch (error) {
        setDiscogsError((error as Error).message);
    } finally {
        setIsLoadingDiscogsData(false);
    }
  }, [record]);

  useEffect(() => {
      if(record && record.discogs_id) {
          fetchDiscogsData();
      }
  }, [record, fetchDiscogsData]);


  const handleDelete = async () => {
    if (!record || !user) return;

    // Viewers can only delete their own non-inventory items.
    if (user.role === 'viewer' && (record.ownerUid !== user.uid || record.isInventoryItem)) {
       toast({ title: "Permission Denied", description: "You cannot delete this record.", variant: "destructive"});
       return;
    }
    // Masters/Workers can delete anything.
    
    setIsDeleting(true);
    try {
      const success = await deleteRecordFromService(record.id);
      if (success) {
        toast({ title: "Record Removed", description: `"${record.title}" has been removed from your collection.`});
        router.back();
      } else {
        toast({ title: "Deletion Failed", description: "Could not remove the record.", variant: "destructive"});
      }
    } catch (error) {
      console.error("Failed to delete record via service:", error);
      toast({
            title: "Storage Error",
            description: "Failed to remove the record. Please try again.",
            variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (user?.role === 'viewer' && record) {
      await toggleFavorite(record.id);
    }
  };

  const handleAddToCart = () => {
    if (user?.role === 'viewer' && record && activeDistributorId) {
      addToCart(record, quantity, activeDistributorId);
    } else if (user?.role === 'viewer' && !activeDistributorId) {
        toast({title: "No Distributor Selected", description: "Please select a distributor's catalog first.", variant: "destructive"});
    }
  };

  const handleAddToCollection = async () => {
      if (!user || !user.email || !record) return;
      setIsSubmittingCollection(true);
      const recordDataForService = {
          ...createFormDefaults(record),
          title: record.title,
          artist: record.artist,
          cover_url: record.cover_url,
          dataAiHint: record.dataAiHint || "album cover",
          isWishlist: false, // Explicitly not a wishlist item
      };

      try {
          const newRecord = await saveRecordToService(recordDataForService, user);
          toast({
              title: "Added to Collection",
              description: `"${newRecord.title}" has been added to your personal collection.`,
          });
          router.push('/collection');
      } catch (error) {
          toast({
              title: "Storage Error",
              description: `Failed to add the record. ${(error as Error).message || "Please try again."}`,
              variant: "destructive",
          });
      } finally {
          setIsSubmittingCollection(false);
      }
  };

  const handleAddToWishlist = async () => {
      if (!user || !user.email || !record) return;
      setIsSubmittingWishlist(true);
      const recordDataForService = {
          ...createFormDefaults(record),
          title: record.title,
          artist: record.artist,
          cover_url: record.cover_url,
          dataAiHint: record.dataAiHint || "album cover",
          isWishlist: true,
      };

      try {
          const newRecord = await saveRecordToService(recordDataForService, user);
          toast({
              title: "Added to Wishlist",
              description: `"${newRecord.title}" has been added to your wishlist.`,
          });
          if (record.isInventoryItem) {
            setWishlistItem(newRecord); // Update state if it's an inventory item
          } else {
            router.push('/wishlist');
          }
      } catch (error) {
          toast({
              title: "Storage Error",
              description: `Failed to add the record to your wishlist. ${(error as Error).message || "Please try again."}`,
              variant: "destructive",
          });
      } finally {
          setIsSubmittingWishlist(false);
      }
  };
  
  const handleRemoveFromWishlist = async () => {
    if (!user || !wishlistItem) return;
    setIsSubmittingWishlist(true);
    try {
      await deleteRecordFromService(wishlistItem.id);
      toast({ title: "Removed from Wishlist", description: `"${record?.title}" has been removed.` });
      setWishlistItem(null); // Clear the state to toggle the button back
    } catch (error) {
      toast({ title: "Error", description: "Could not remove from wishlist.", variant: "destructive" });
    } finally {
      setIsSubmittingWishlist(false);
    }
  };

  
  const handleRegenerateAiInfo = async () => {
    if (!record || !user || user.role !== 'master' || !user.email) return;
    setIsReGenerating(true);
    toast({ title: "Re-generating AI Info...", description: "Please wait a moment." });
    try {
        const result = await generateRecordInfo({ 
            artist: record.artist, 
            title: record.title, 
            year: record.year ? Number(record.year) : undefined,
            distributorId: record.distributorId,
        });
        const updatedRecordData = await updateRecordInService(
            record.id,
            { artistBio: result.artistBio, albumInfo: result.albumInfo },
            user
        );
        if (updatedRecordData) {
            setRecord(updatedRecordData);
            toast({ title: "Success", description: "AI content has been re-generated and saved." });
        }
    } catch (error) {
        console.error("Failed to re-generate AI info:", error);
        toast({ title: "Error", description: "Could not re-generate AI info.", variant: "destructive" });
    } finally {
        setIsReGenerating(false);
    }
  };

  const handleStockAndLocationUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!record || !user || !user.email) return;

    const formData = new FormData(e.currentTarget);
    const shelfAdjustment = parseInt(formData.get('shelf_adjustment') as string || '0', 10);
    const storageAdjustment = parseInt(formData.get('storage_adjustment') as string || '0', 10);

    if (isNaN(shelfAdjustment) || isNaN(storageAdjustment)) {
        toast({ title: "Invalid input", description: "Please enter a valid number to adjust stock.", variant: "destructive" });
        return;
    }

    try {
        const updated = await adjustStock(
            recordId, 
            { 
                shelves: shelfAdjustment, 
                storage: storageAdjustment, 
                shelf_locations: dialogShelfLocations,
                storage_locations: dialogStorageLocations
            }, 
            user
        );
        if (updated) {
            setRecord(updated);
            toast({ title: "Stock Adjusted", description: "The stock levels and locations have been updated." });
            setIsAdjustStockOpen(false);
        }
    } catch(error) {
        toast({ title: "Error", description: `Failed to adjust stock: ${(error as Error).message}`, variant: "destructive" });
    }
  };

  const isFavorite = user?.role === 'viewer' && record && user.favorites?.includes(record.id);

  const perms = user?.permissions || {};
  const canViewPurchasing = isMaster || (isOperator && (!!perms.canViewPurchasingPrice || !!perms.canEditPurchasingPrice));
  const canViewSelling = isMaster || (isOperator && (!!perms.canViewSellingPrice || !!perms.canEditSellingPrice));
  const canViewSupplier = isMaster || (isOperator && !!perms.canEditSuppliers);


  if (!user && !isLoadingRecord) {
     return (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Loading user data...</p>
        </div>
    );
  }
  
  if (isLoadingRecord) {
    return (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2">Loading record details...</p>
        </div>
    );
  }

  if (!record) {
    return (
        <div className="text-center py-12">
          <Disc3 className="mx-auto h-16 w-16 text-muted-foreground" />
          <h3 className="mt-4 text-xl font-semibold">Record Not Found</h3>
          <p className="mt-2 text-muted-foreground">The requested record could not be found.</p>
          <Button onClick={() => router.back()} className="mt-6">
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
    );
  }

  const totalStock = Number(record.stock_shelves || 0) + Number(record.stock_storage || 0);
  const canBePurchased = user?.role === 'viewer' && record.isInventoryItem !== false && totalStock > 0 && (record.sellingPrice ?? -1) >= 0;

  return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Button onClick={() => router.back()} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <Card className="shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-1 p-4 flex flex-col gap-4">
               <Image
                src={record.cover_url || `https://placehold.co/600x600.png`}
                alt={`${record.title} cover art`}
                width={600}
                height={600}
                className="rounded-md object-cover aspect-square w-full shadow-lg"
                data-ai-hint={record.dataAiHint || "album cover"}
                unoptimized={record.cover_url?.includes('discogs.com')}
              />
              <div className="hidden md:flex flex-col gap-2">
                {record.discogs_id && (
                    <Button variant="outline" asChild>
                        <a href={`https://www.discogs.com/release/${record.discogs_id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2"/> View on Discogs
                        </a>
                    </Button>
                )}
                
                {isOperator && (
                  <>
                    <Button asChild><Link href={`/records/${record.id}/edit`}><Edit className="mr-2"/> Edit Record</Link></Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" disabled={isDeleting}><Trash2 className="mr-2"/> Delete Record</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete &quot;{record.title}&quot; from your collection.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>{isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
                
                {user?.role === 'viewer' && record.isInventoryItem && (
                    <>
                        <Button variant={isFavorite ? "secondary" : "outline"} onClick={handleToggleFavorite} disabled={isSubmittingCollection || isSubmittingWishlist}>
                            <Heart className={`mr-2 h-4 w-4 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
                            {isFavorite ? 'In Favorites' : 'Add to Favorites'}
                        </Button>
                        
                        {isCheckingWishlist ? (
                            <Button variant="outline" disabled>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                <span>Checking Wishlist...</span>
                            </Button>
                        ) : (
                            <Button 
                                variant={wishlistItem ? "secondary" : "outline"} 
                                onClick={wishlistItem ? handleRemoveFromWishlist : handleAddToWishlist} 
                                disabled={isSubmittingWishlist || isSubmittingCollection}
                            >
                                {isSubmittingWishlist ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (wishlistItem ? <Check className="h-4 w-4 mr-2" /> : <ListChecks className="h-4 w-4 mr-2" />)}
                                <span>{wishlistItem ? "On Your Wishlist" : "Add to Wishlist"}</span>
                            </Button>
                        )}
                        <Button variant="outline" onClick={handleAddToCollection} disabled={isSubmittingWishlist || isSubmittingCollection}>
                            {isSubmittingCollection ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Library className="mr-2 h-4 w-4" />}
                            <span>Add to My Collection</span>
                        </Button>
                    </>
                )}

                 {user?.role === 'viewer' && !record.isInventoryItem && (
                    <>
                         <Button variant={isFavorite ? "secondary" : "outline"} onClick={handleToggleFavorite}>
                            <Heart className={`mr-2 h-4 w-4 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
                            {isFavorite ? 'In Favorites' : 'Add to Favorites'}
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={isDeleting}>
                                    <Trash2 className="mr-2 h-4 w-4"/>
                                    Remove from Collection
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently remove &quot;{record.title}&quot; from your collection.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Remove
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </>
                )}
              </div>
            </div>
            <div className="md:col-span-2 flex flex-col p-4">
              <CardHeader className="p-0 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-primary">{record.title}</h2>
                    <h3 className="text-xl text-muted-foreground">{record.artist}</h3>
                  </div>
                   <div className="flex items-center flex-shrink-0 gap-2 md:hidden">
                    {record.discogs_id && (
                      <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-primary h-9 w-9">
                          <a href={`https://www.discogs.com/release/${record.discogs_id}`} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-5 w-5" />
                          </a>
                      </Button>
                    )}
                    {user?.role === 'viewer' && (
                        <>
                            <Button variant="ghost" size="icon" onClick={handleToggleFavorite} className="text-muted-foreground hover:text-primary h-9 w-9">
                              <Heart className={`h-5 w-5 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
                            </Button>
                             {record.isInventoryItem ? (
                                <>
                                    <Button variant="ghost" size="icon" onClick={wishlistItem ? handleRemoveFromWishlist : handleAddToWishlist} disabled={isSubmittingWishlist || isCheckingWishlist || isSubmittingCollection} className="text-muted-foreground hover:text-primary h-9 w-9">
                                        {isSubmittingWishlist || isCheckingWishlist ? <Loader2 className="h-5 w-5 animate-spin"/> : (wishlistItem ? <Check className="h-5 w-5 text-primary" /> : <ListChecks className="h-5 w-5" />) }
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={handleAddToCollection} disabled={isSubmittingCollection || isSubmittingWishlist} className="text-muted-foreground hover:text-primary h-9 w-9">
                                      {isSubmittingCollection ? <Loader2 className="h-5 w-5 animate-spin" /> : <Library className="h-5 w-5" />}
                                    </Button>
                                </>
                             ) : (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" disabled={isDeleting} className="text-muted-foreground hover:text-destructive h-9 w-9">
                                            {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will permanently remove &quot;{record.title}&quot; from your collection.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                                                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                                Remove
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                             )}
                        </>
                    )}
                    {isOperator && (
                        <>
                            <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-accent h-9 w-9">
                                <Link href={`/records/${record.id}/edit`}>
                                    <Edit className="h-5 w-5" />
                                </Link>
                            </Button>
                            <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-9 w-9" disabled={isDeleting}>{isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}</Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete &quot;{record.title}&quot;.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>{isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Delete</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                            </AlertDialog>
                        </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-grow">
                <SectionHeader title="Record Details" />
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <DetailItem icon={Layers3} label="Label" value={record.label} />
                  <DetailItem icon={CalendarDays} label="Released" value={record.releasedDate || record.year?.toString()} isDate={!!record.releasedDate} />
                  <DetailItem icon={Music} label="Genre(s)" value={record.genre} />
                  <DetailItem icon={Paintbrush} label="Style(s)" value={record.style} />
                  <DetailItem icon={Disc3} label="Discogs ID" value={record.discogs_id} />
                  {record.barcode && <DetailItem icon={Barcode} label="Barcode" value={record.barcode} />}
                  <DetailItem icon={Tag} label="Media Condition" value={record.media_condition} />
                  <DetailItem icon={Tag} label="Sleeve Condition" value={record.sleeve_condition} />
                  <DetailItem icon={Globe} label="Country" value={record.country} />
                  <DetailItem icon={Info} label="Format Details" value={record.formatDetails} />
                </div>

                {isOperator && (
                  <>
                    <SectionHeader title="Inventory" />
                     <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                        <DetailItem icon={Store} label="Stock (Shelves)" value={record.stock_shelves} />
                        <DetailItem icon={MapPin} label="Shelf Locations" value={allShelfLocations.length > 0 ? <div className="flex flex-wrap gap-1">{allShelfLocations.map(loc => <Badge key={loc} variant="secondary">{loc}</Badge>)}</div> : "N/A"} />
                        <DetailItem icon={Warehouse} label="Stock (Storage)" value={record.stock_storage} />
                        <DetailItem icon={MapPin} label="Storage Locations" value={allStorageLocations.length > 0 ? <div className="flex flex-wrap gap-1">{allStorageLocations.map(loc => <Badge key={loc} variant="secondary">{loc}</Badge>)}</div> : "N/A"} />
                        <DetailItem icon={Package} label="Total Stock" value={totalStock} />
                        {record.weight && <DetailItem icon={Weight} label="Weight" value={`${record.weight} g`} />}
                    </div>

                    <SectionHeader title="Pricing" />
                     <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                       {canViewPurchasing && record.purchasingPrice != null && <DetailItem icon={Euro} label="Purchasing Price" value={record.purchasingPrice} isCurrency={true} />}
                       {canViewSelling && record.sellingPrice != null && <DetailItem icon={Euro} label="Selling Price" value={record.sellingPrice} isCurrency={true} />}
                        {canViewSupplier && record.supplierId && supplierName && (
                            <DetailItem 
                                icon={Briefcase} 
                                label="Supplier" 
                                value={<Link href={`/suppliers/${record.supplierId}`} className="text-primary hover:underline">{supplierName}</Link>} 
                            />
                        )}
                    </div>
                  </>
                )}

                 {user?.role === 'viewer' && record.sellingPrice != null && record.isInventoryItem && (
                    <div className="mt-6">
                        <SectionHeader title="Price" />
                        <DetailItem icon={Euro} label="Price" value={record.sellingPrice} isCurrency={true} />
                    </div>
                )}
                
                {record.notes && (
                  <>
                     <SectionHeader title="Notes" />
                     <p className="text-base text-foreground/80 whitespace-pre-wrap">{record.notes}</p>
                  </>
                )}
                
              </CardContent>

              {user?.role === 'viewer' && (
                <CardFooter className="flex flex-col items-start gap-4 pt-6 border-t mt-6">
                  {canBePurchased && (
                    <div className="flex items-center gap-4 w-full">
                        <div className="flex items-center border rounded-md">
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4"/></Button>
                        <Input type="number" value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} className="w-16 h-9 text-center border-x border-y-0 rounded-none focus-visible:ring-0"/>
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setQuantity(q => q + 1)}><Plus className="h-4 w-4"/></Button>
                        </div>
                        <Button onClick={handleAddToCart} className="flex-grow">
                        <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
                        </Button>
                    </div>
                  )}
                </CardFooter>
              )}

              {isOperator && (
                 <CardFooter className="p-4 pt-4 mt-6 border-t">
                    <p className="text-xs text-muted-foreground">
                        Added: <strong>{record.added_by_email || 'N/A'}</strong> on {format(new Date(record.added_at), 'Pp')}
                        {record.last_modified_by_email && record.last_modified_at && record.last_modified_at !== record.added_at && (
                            <>
                                <span className="mx-2">|</span>
                                Modified: <strong>{record.last_modified_by_email}</strong> on {format(new Date(record.last_modified_at), 'Pp')}
                            </>
                        )}
                    </p>
                 </CardFooter>
              )}
            </div>
          </div>
        </Card>
        
        {record.discogs_id && (
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <BarChart3 className="h-6 w-6 text-primary" />
                        <span>Discogs Community & Market Stats</span>
                    </CardTitle>
                    <CardDescription>
                        Live data from the Discogs community and marketplace.
                        {discogsData?.lastFetched && (
                        <>
                            {' '}Last updated: {format(new Date(discogsData.lastFetched), 'Pp')}
                        </>
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingDiscogsData && (
                        <div className="flex items-center justify-center h-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="ml-2">Loading Discogs data...</p>
                        </div>
                    )}
                    {discogsError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Could not load Discogs Stats</AlertTitle>
                        <AlertDescription>{discogsError}</AlertDescription>
                    </Alert>
                    )}
                    {discogsData && !isLoadingDiscogsData && !discogsError && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                       {typeof discogsData.community?.have === 'number' && <StatBox label="Have" value={discogsData.community.have.toLocaleString()} icon={Users} subtext="in collections" />}
                       {typeof discogsData.community?.want === 'number' && <StatBox label="Want" value={discogsData.community.want.toLocaleString()} icon={Heart} subtext="on wantlists" />}
                       {discogsData.community?.rating && <StatBox label="Rating" value={`${discogsData.community.rating.average.toFixed(2)} / 5`} icon={Star} subtext={`from ${discogsData.community.rating.count} ratings`} />}
                       {marketStats?.lowest_price?.value ? (
                          <StatBox label="Lowest Price" value={marketStats.lowest_price.value} subtext={`from ${marketStats.num_for_sale} listings`} isCurrency={true} icon={TrendingDown}/>
                        ) : (
                          <StatBox label="Lowest Price" value="N/A" subtext={marketStats ? 'No listings found' : ''} icon={TrendingDown}/>
                        )}
                    </div>
                    )}
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground pt-4 border-t">
                    This data is provided by Discogs. Price is based on the lowest currently available listing. Median, Highest, and Last Sold prices are not available via the public API.
                </CardFooter>
            </Card>
        )}

        {record.tracklist && record.tracklist.length > 0 && (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <ListMusic className="h-6 w-6 text-primary" />
                <span>Tracklist</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">#</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {record.tracklist.map((track, index) => (
                    <TableRow key={`${track.position}-${index}`}>
                      <TableCell className="font-medium">{track.position}</TableCell>
                      <TableCell>{track.title}</TableCell>
                      <TableCell className="text-right">{track.duration || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {isGeneratingAiInfo && !record.artistBio && (
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span>Generating Information...</span>
                    </CardTitle>
                    <CardDescription>Our AI is writing about the artist and album. This may take a moment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                    </div>
                </CardContent>
            </Card>
        )}

        {record.artistBio && (
            <Card className="shadow-xl">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="flex items-center gap-3">
                            <UserCircle className="h-6 w-6 text-primary" />
                            <span>About {record.artist}</span>
                        </CardTitle>
                         {user?.role === 'master' && (
                            <Button variant="outline" size="sm" onClick={handleRegenerateAiInfo} disabled={isReGenerating || isGeneratingAiInfo}>
                                {isReGenerating || isGeneratingAiInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                <span className="ml-2 hidden sm:inline">Re-generate</span>
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">{record.artistBio}</p>
                </CardContent>
                <CardFooter className="text-xs text-muted-foreground pt-4 border-t">
                    AI-generated content. May contain inaccuracies. Edit via the main edit page.
                </CardFooter>
            </Card>
        )}

        {record.albumInfo && (
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Disc3 className="h-6 w-6 text-primary" />
                        <span>About The Album: {record.title}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                     <p className="whitespace-pre-wrap text-base leading-relaxed text-foreground/90">{record.albumInfo}</p>
                </CardContent>
                 <CardFooter className="text-xs text-muted-foreground pt-4 border-t">
                    AI-generated content.
                </CardFooter>
            </Card>
        )}

        {isOperator && discogsListing && (
            <Card className="shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                        <Disc3 className="h-6 w-6 text-primary" />
                        <span>Discogs Listing Details</span>
                    </CardTitle>
                    <CardDescription>
                        This record is listed on your Discogs inventory.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                        <DetailItem icon={Tag} label="Media Condition" value={discogsListing.condition} />
                        <DetailItem icon={Tag} label="Sleeve Condition" value={discogsListing.sleeve_condition} />
                        <DetailItem icon={Euro} label="Listing Price" value={discogsListing.price.value} isCurrency={true} />
                    </div>
                    {discogsListing.comments && (
                        <div>
                            <h4 className="font-semibold text-sm mb-1">Seller Comments</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{discogsListing.comments}</p>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button asChild variant="outline">
                        <a href={`https://www.discogs.com/sell/item/${discogsListing.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" /> View Listing on Discogs
                        </a>
                    </Button>
                </CardFooter>
            </Card>
        )}
        
        {isOperator && (
            <Dialog open={isAdjustStockOpen} onOpenChange={setIsAdjustStockOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-8">Adjust Stock for &quot;{record.title}&quot;</DialogTitle>
                        <p className="text-sm text-muted-foreground truncate pr-8">{record.artist}</p>
                    </DialogHeader>
                    <form onSubmit={handleStockAndLocationUpdate}>
                        <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                             <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
                                <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Current Shelf Stock</p>
                                    <p className="text-2xl font-bold">{record.stock_shelves || 0}</p>
                                </div>
                                 <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Current Storage Stock</p>
                                    <p className="text-2xl font-bold">{record.stock_storage || 0}</p>
                                </div>
                            </div>

                            <h4 className="font-semibold text-foreground border-t pt-4">Stock Adjustment</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="shelf_adjustment">Shelves</Label>
                                    <Input id="shelf_adjustment" name="shelf_adjustment" type="number" defaultValue="0" maxLength={4} className="mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="storage_adjustment">Storage</Label>
                                    <Input id="storage_adjustment" name="storage_adjustment" type="number" defaultValue="0" maxLength={4} className="mt-1" />
                                </div>
                            </div>
                            
                            <Separator className="my-2" />
                            
                            <h4 className="font-semibold text-foreground">Location Management</h4>
                            
                             <LocationSelector
                                title="Shelf Locations"
                                availableLocations={activeDistributor?.shelfLocations || []}
                                selectedLocations={dialogShelfLocations}
                                onSelectedLocationsChange={setDialogShelfLocations}
                                canManageLocations={canManageLocations}
                                onUpdateAvailableLocations={async (newLocs) => updateMyDistributorSettings({ shelfLocations: newLocs })}
                            />
                            <LocationSelector
                                title="Storage Locations"
                                availableLocations={activeDistributor?.storageLocations || []}
                                selectedLocations={dialogStorageLocations}
                                onSelectedLocationsChange={setDialogStorageLocations}
                                canManageLocations={canManageLocations}
                                onUpdateAvailableLocations={async (newLocs) => updateMyDistributorSettings({ storageLocations: newLocs })}
                            />
                        </div>
                        <DialogFooter className="pt-4 border-t">
                            <Button type="button" variant="ghost" onClick={() => setIsAdjustStockOpen(false)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        )}

      </div>
  );
}

// LocationSelector Component for Adjust Stock Dialog
const LocationSelector = ({
    title,
    availableLocations,
    selectedLocations,
    onSelectedLocationsChange,
    canManageLocations,
    onUpdateAvailableLocations,
}: {
    title: string,
    availableLocations: string[],
    selectedLocations: string[],
    onSelectedLocationsChange: (locs: string[]) => void,
    canManageLocations: boolean,
    onUpdateAvailableLocations: (locs: string[]) => void,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const handleCreate = async () => {
        if (!canManageLocations || !search || availableLocations.includes(search)) return;
        const newLocations = [...availableLocations, search].sort();
        await onUpdateAvailableLocations(newLocations);
        onSelectedLocationsChange([...selectedLocations, search]);
        setSearch("");
        setOpen(false);
    };
    
    const filteredOptions = availableLocations.filter(loc => 
        !selectedLocations.includes(loc) && loc.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-2">
            <Label>{title}</Label>
            <div className="flex items-start gap-2">
                <div className="flex-grow rounded-md border p-2 min-h-[40px] flex flex-wrap gap-1">
                    {selectedLocations.length > 0 ? selectedLocations.map((loc) => (
                        <Badge key={loc} variant="secondary" className="flex items-center gap-1">
                            {loc}
                            <button type="button" onClick={() => onSelectedLocationsChange(selectedLocations.filter(l => l !== loc))} className="rounded-full hover:bg-destructive/20 text-destructive/80 hover:text-destructive"><X className="h-3 w-3"/></button>
                        </Badge>
                    )) : <span className="text-xs text-muted-foreground px-2">No locations selected.</span>}
                </div>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0">
                            <PlusCircle className="h-4 w-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                            <CommandInput
                                placeholder="Search locations..."
                                value={search}
                                onValueChange={setSearch}
                            />
                            <CommandList>
                                <CommandEmpty>
                                    {canManageLocations ? (
                                        <Button variant="ghost" className="w-full" onClick={handleCreate}>
                                            Create and add &quot;{search}&quot;
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
                                                onSelectedLocationsChange([...selectedLocations, loc]);
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
        </div>
    );
};

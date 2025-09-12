

import type { VinylRecord, UserRole } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Package, Heart, Euro, ShoppingCart, Store, Warehouse, Info, Disc3, Globe, MapPin, CalendarDays } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { formatPriceForDisplay } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { Separator } from "../ui/separator";
import { useMemo } from "react";

interface RecordCardProps {
  record: VinylRecord;
  isOperator?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (recordId: string) => void;
  isInInventory?: boolean; 
  isInDiscogs?: boolean;
}

export default function RecordCard({ record, isOperator, isFavorite, onToggleFavorite, isInDiscogs }: RecordCardProps) {
  const { addToCart, activeDistributorId, activeDistributor } = useAuth();
  
  const defaultCardSettings = {
    showTitle: true,
    showArtist: true,
    showYear: false,
    showCountry: false,
    showShelfStock: true,
    showStorageStock: true,
    showTotalStock: true,
    showFormat: false,
  };
  const settings = activeDistributor?.cardDisplaySettings || defaultCardSettings;
  
  const totalStock = Number(record.stock_shelves || 0) + Number(record.stock_storage || 0);
  
  const allLocations = useMemo(() => {
    const locations = new Set<string>();
    // Handle new array format
    if (Array.isArray(record.shelf_locations)) record.shelf_locations.forEach(loc => loc && locations.add(loc.trim()));
    if (Array.isArray(record.storage_locations)) record.storage_locations.forEach(loc => loc && locations.add(loc.trim()));
    // Handle old string format, which might still exist in some records
    if (typeof record.shelf_location === 'string') record.shelf_location.split(',').forEach(loc => loc.trim() && locations.add(loc.trim()));
    if (typeof record.storage_location === 'string') record.storage_location.split(',').forEach(loc => loc.trim() && locations.add(loc.trim()));
    return Array.from(locations);
  }, [record.shelf_locations, record.storage_locations, record.shelf_location, record.storage_location]);

  const locationDisplayString = useMemo(() => {
    if (allLocations.length === 0) return null;
    const firstTwo = allLocations.slice(0, 2);
    if (allLocations.length > 2) {
      return `${firstTwo.join(', ')}, ...`;
    }
    return firstTwo.join(', ');
  }, [allLocations]);


  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(record.id);
  };

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeDistributorId) {
        addToCart(record, 1, activeDistributorId);
    }
  };

  const isAvailable = record.isInventoryItem && totalStock > 0;
  const canBePurchased = !isOperator && isAvailable && (record.sellingPrice ?? -1) >= 0;

  const getStockBadge = () => {
    if (isOperator || !record.isInventoryItem) return null;

    if (totalStock <= 0) {
        return <Badge variant="destructive" className="absolute bottom-2 left-2 z-10">Out of Stock</Badge>;
    }
    if (totalStock <= 10) {
        return <Badge variant="secondary" className="absolute bottom-2 left-2 z-10">Low Stock ({totalStock})</Badge>;
    }
    return <Badge variant="default" className="absolute bottom-2 left-2 z-10">In Stock</Badge>;
  };
  
  const formats = record.formatDetails?.split(',').map(f => f.trim()) || [];
  const displayFormats = formats.length > 3 ? `${formats.slice(0, 3).join(', ')}, and more...` : formats.join(', ');

  return (
    <Link href={`/records/${record.id}`} legacyBehavior>
      <a className="block hover:shadow-lg transition-shadow duration-200 rounded-lg group h-full">
        <Card className="h-full flex flex-col overflow-hidden bg-card hover:bg-card/90 transition-colors">
           <div className="absolute top-2 right-2 z-10 flex flex-col gap-1.5">
            {isOperator && isInDiscogs && (
                 <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm text-black hover:bg-white flex items-center gap-1.5 self-end p-1.5">
                    <Disc3 className="h-4 w-4" />
                    <span className="sr-only">Listed on Discogs</span>
                </Badge>
            )}
            {!isOperator && onToggleFavorite && (
                <Button
                variant="ghost"
                size="icon"
                onClick={handleFavoriteClick}
                className="relative bg-card/70 backdrop-blur-sm hover:bg-card text-muted-foreground hover:text-primary h-8 w-8"
                aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                >
                <Heart className={`h-5 w-5 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
                </Button>
            )}
           </div>
          <CardHeader className="p-0">
            <div className="aspect-square relative w-full">
              <Image
                src={record.cover_url || `https://placehold.co/300x300.png`}
                alt={`${record.title} cover art`}
                layout="fill"
                objectFit="cover"
                className="transition-transform duration-300 group-hover:scale-105"
                data-ai-hint={record.dataAiHint || "album cover"}
                unoptimized={record.cover_url?.includes('discogs.com')}
              />
              {getStockBadge()}
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-grow flex flex-col">
            {settings.showTitle && <p className="text-lg font-semibold leading-tight mb-1 truncate" title={record.title}>{record.title}</p>}
            {settings.showArtist && <p className="text-sm text-muted-foreground truncate mb-2" title={record.artist}>{record.artist}</p>}
            
            <div className="flex flex-col gap-1.5 text-sm mt-auto pt-2">
              <div className="flex items-center gap-4 text-xs">
                {settings.showYear && (
                    <span className="text-muted-foreground flex items-center gap-1.5" title={`Year: ${record.year || 'N/A'}`}>
                        <CalendarDays className="h-3.5 w-3.5"/>
                        <span>{record.year || 'N/A'}</span>
                    </span>
                )}
                {settings.showCountry && record.country && (
                    <span className="text-muted-foreground flex items-center gap-1.5" title={`Country: ${record.country}`}>
                        <Globe className="h-3.5 w-3.5"/>{record.country}
                    </span>
                )}
              </div>

              {settings.showFormat && displayFormats && <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3"/>{displayFormats}</p>}

              {isOperator && record.isInventoryItem !== false && (
                <>
                  <Separator className="my-1"/>
                   <div className="flex items-center gap-4 text-xs">
                        {settings.showShelfStock && (
                            <span className="flex items-center gap-1.5" title={`Shelves: ${record.stock_shelves || 0}`}>
                                <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="text-foreground font-medium">{record.stock_shelves || 0}</span>
                            </span>
                        )}
                        {settings.showStorageStock && (
                            <span className="flex items-center gap-1.5" title={`Storage: ${record.stock_storage || 0}`}>
                                <Warehouse className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                <span className="text-foreground font-medium">{record.stock_storage || 0}</span>
                            </span>
                        )}
                        {(settings.showShelfStock || settings.showStorageStock) && settings.showTotalStock && <span className="text-muted-foreground">|</span>}
                        {settings.showTotalStock && (
                            <span className="flex items-center gap-1.5 font-semibold" title="Total Stock">
                                <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
                                <span>{totalStock}</span>
                            </span>
                        )}
                    </div>
                     {locationDisplayString && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate" title={`Locations: ${allLocations.join(', ')}`}>
                            <MapPin className="h-3.5 w-3.5 shrink-0"/>
                            <span className="truncate">{locationDisplayString}</span>
                        </div>
                    )}
                </>
              )}
            </div>
            
          </CardContent>
          {!isOperator && (
            <CardFooter className="p-4 pt-0 border-t mt-auto border-border/50 flex justify-between items-center min-h-[48px]">
               {record.sellingPrice != null ? (
                <div className="flex items-center gap-1.5 text-base font-semibold text-primary" title={`Price: €${formatPriceForDisplay(record.sellingPrice)}`}>
                  <Euro className="h-4 w-4" />
                  <span>{formatPriceForDisplay(record.sellingPrice)}</span>
                </div>
               ) : <div/>}
               {canBePurchased && (
                  <Button variant="outline" size="icon" onClick={handleAddToCartClick} className="ml-auto h-8 w-8" aria-label="Add to cart">
                      <ShoppingCart className="h-4 w-4"/>
                  </Button>
               )}
            </CardFooter>
          )}
        </Card>
      </a>
    </Link>
  );
}

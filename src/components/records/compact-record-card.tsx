
"use client";

import type { VinylRecord } from "@/types";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Euro, ShoppingCart, Disc3 } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { formatPriceForDisplay } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";

interface CompactRecordCardProps {
  record: VinylRecord;
  isOperator?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (recordId: string) => void;
  isInDiscogs?: boolean;
}

export default function CompactRecordCard({ record, isOperator, isFavorite, onToggleFavorite, isInDiscogs }: CompactRecordCardProps) {
  const { addToCart, activeDistributorId } = useAuth();
  
  const totalStock = Number(record.stock_shelves || 0) + Number(record.stock_storage || 0);

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

  return (
    <Link href={`/records/${record.id}`} legacyBehavior>
      <a className="block group h-full">
        <Card className="h-full flex flex-col overflow-hidden bg-card hover:bg-card/90 transition-colors duration-200">
           <div className="relative">
             <Image
                src={record.cover_url || `https://placehold.co/150x150.png`}
                alt={`${record.title} cover art`}
                width={150}
                height={150}
                className="w-full object-cover aspect-square transition-transform duration-300 group-hover:scale-105"
                data-ai-hint={record.dataAiHint || "album cover"}
                unoptimized={record.cover_url?.includes('discogs.com')}
              />
               {isInDiscogs && (
                 <Badge variant="secondary" className="absolute top-1 right-1 bg-white/80 backdrop-blur-sm text-black hover:bg-white p-1 h-auto">
                    <Disc3 className="h-3 w-3" />
                </Badge>
              )}
           </div>
          <CardContent className="p-2 flex-grow flex flex-col text-xs">
            <p className="font-semibold leading-tight line-clamp-2" title={record.title}>{record.title}</p>
            <p className="text-muted-foreground line-clamp-1" title={record.artist}>{record.artist}</p>
            
            <div className="mt-auto pt-2 flex justify-between items-center">
                {record.sellingPrice != null ? (
                    <div className="flex items-center gap-1 font-semibold text-primary">
                      <Euro className="h-3.5 w-3.5" />
                      <span>{formatPriceForDisplay(record.sellingPrice)}</span>
                    </div>
                ) : <div/>}
                
                {canBePurchased ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleAddToCartClick}
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        aria-label="Add to cart"
                    >
                        <ShoppingCart className="h-4 w-4" />
                    </Button>
                ) : !isOperator && onToggleFavorite ? (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleFavoriteClick}
                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                        aria-label={isFavorite ? "Remove from Favorites" : "Add to Favorites"}
                    >
                        <Heart className={`h-4 w-4 ${isFavorite ? 'fill-primary text-primary' : ''}`} />
                    </Button>
                ) : null}
            </div>
          </CardContent>
        </Card>
      </a>
    </Link>
  );
}

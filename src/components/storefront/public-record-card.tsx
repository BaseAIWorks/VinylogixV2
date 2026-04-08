"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Euro, Eye } from "lucide-react";
import { formatPriceForDisplay } from "@/lib/utils";
import type { CardDisplaySettings } from "@/types";

export interface PublicRecord {
  id: string;
  title?: string;
  artist?: string;
  year?: number;
  genre?: string[];
  style?: string[];
  format?: string;
  formatDetails?: string;
  country?: string;
  media_condition?: string;
  sleeve_condition?: string;
  cover_url?: string;
  label?: string;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  sellingPrice?: number;
  tracklist?: { position?: string; title?: string; duration?: string }[];
}

interface PublicRecordCardProps {
  record: PublicRecord;
  cardDisplaySettings?: CardDisplaySettings;
  isApprovedClient?: boolean;
  onAddToCart?: (recordId: string) => void;
  onClick?: (record: PublicRecord) => void;
}

export default function PublicRecordCard({
  record,
  cardDisplaySettings,
  isApprovedClient,
  onAddToCart,
  onClick,
}: PublicRecordCardProps) {
  const settings = cardDisplaySettings || {
    showTitle: true,
    showArtist: true,
    showYear: false,
    showCountry: false,
    showShelfStock: false,
    showStorageStock: false,
    showTotalStock: false,
    showFormat: false,
  };

  const stockBadge = () => {
    if (!record.stockStatus || record.stockStatus === 'out_of_stock') {
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Out of Stock</Badge>;
    }
    if (record.stockStatus === 'low_stock') {
      return <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/90 hover:bg-amber-500/90 text-white border-0">Low Stock</Badge>;
    }
    return null; // Don't show badge for in-stock (cleaner)
  };

  const badge = stockBadge();

  return (
    <div
      className="group cursor-pointer"
      onClick={() => onClick?.(record)}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
        {record.cover_url ? (
          <Image
            src={record.cover_url}
            alt={record.title || 'Vinyl Record'}
            fill
            className="object-cover transition-all duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/5">
            <div className="text-5xl text-muted-foreground/20">&#9834;</div>
          </div>
        )}

        {/* Stock badge */}
        {badge && (
          <div className="absolute left-2 top-2">{badge}</div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
          <Button size="sm" variant="secondary" className="h-8 text-xs">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            View Details
          </Button>
          {isApprovedClient && onAddToCart && record.stockStatus !== 'out_of_stock' && record.sellingPrice != null && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart(record.id);
              }}
            >
              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
              Add to Cart
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-2.5 space-y-1">
        {settings.showTitle && record.title && (
          <p className="line-clamp-1 text-sm font-medium leading-snug group-hover:text-primary transition-colors">
            {record.title}
          </p>
        )}
        {settings.showArtist && record.artist && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {record.artist}
          </p>
        )}

        {/* Metadata row */}
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground/70">
          {record.year && <span>{record.year}</span>}
          {record.formatDetails && (
            <span>{record.year ? '· ' : ''}{record.formatDetails}</span>
          )}
          {record.media_condition && (
            <span>{(record.year || record.formatDetails) ? '· ' : ''}{record.media_condition}</span>
          )}
        </div>

        {/* Genre tags */}
        {record.genre && record.genre.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {record.genre.slice(0, 2).map((g) => (
              <span key={g} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        {isApprovedClient && record.sellingPrice != null && record.sellingPrice >= 0 && (
          <p className="flex items-center gap-0.5 pt-1 text-sm font-semibold text-primary">
            <Euro className="h-3.5 w-3.5" />
            {formatPriceForDisplay(record.sellingPrice)}
          </p>
        )}
      </div>
    </div>
  );
}

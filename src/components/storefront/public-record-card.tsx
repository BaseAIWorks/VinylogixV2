"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Euro } from "lucide-react";
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
}

interface PublicRecordCardProps {
  record: PublicRecord;
  cardDisplaySettings?: CardDisplaySettings;
  isApprovedClient?: boolean;
  onAddToCart?: (recordId: string) => void;
}

export default function PublicRecordCard({
  record,
  cardDisplaySettings,
  isApprovedClient,
  onAddToCart,
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
      return <Badge variant="destructive" className="text-xs">Out of Stock</Badge>;
    }
    if (record.stockStatus === 'low_stock') {
      return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Low Stock</Badge>;
    }
    return <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">In Stock</Badge>;
  };

  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-muted">
        {record.cover_url ? (
          <Image
            src={record.cover_url}
            alt={record.title || 'Vinyl Record'}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-4xl text-muted-foreground/30">&#9834;</div>
          </div>
        )}
        <div className="absolute right-2 top-2">
          {stockBadge()}
        </div>
      </div>
      <CardContent className="space-y-1.5 p-3">
        {settings.showTitle && record.title && (
          <p className="line-clamp-1 text-sm font-semibold leading-tight">
            {record.title}
          </p>
        )}
        {settings.showArtist && record.artist && (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {record.artist}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1">
          {settings.showYear && record.year && (
            <span className="text-xs text-muted-foreground">{record.year}</span>
          )}
          {settings.showFormat && record.formatDetails && (
            <span className="text-xs text-muted-foreground">
              {settings.showYear && record.year ? '· ' : ''}{record.formatDetails}
            </span>
          )}
          {settings.showCountry && record.country && (
            <span className="text-xs text-muted-foreground">
              · {record.country}
            </span>
          )}
        </div>
        {record.media_condition && (
          <p className="text-xs text-muted-foreground">
            Media: {record.media_condition}
            {record.sleeve_condition ? ` / Sleeve: ${record.sleeve_condition}` : ''}
          </p>
        )}

        {isApprovedClient && record.sellingPrice != null && record.sellingPrice >= 0 ? (
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-0.5 text-sm font-semibold text-primary">
              <Euro className="h-3.5 w-3.5" />
              {formatPriceForDisplay(record.sellingPrice)}
            </span>
            {onAddToCart && record.stockStatus !== 'out_of_stock' && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddToCart(record.id);
                }}
              >
                <ShoppingCart className="mr-1 h-3 w-3" />
                Add
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

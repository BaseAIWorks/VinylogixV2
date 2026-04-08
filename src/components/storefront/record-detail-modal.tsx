"use client";

import Image from "next/image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Euro, Disc3, X } from "lucide-react";
import { formatPriceForDisplay } from "@/lib/utils";
import type { PublicRecord } from "./public-record-card";

interface RecordDetailModalProps {
  record: PublicRecord | null;
  isOpen: boolean;
  onClose: () => void;
  isApprovedClient?: boolean;
  onAddToCart?: (recordId: string) => void;
}

export default function RecordDetailModal({
  record,
  isOpen,
  onClose,
  isApprovedClient,
  onAddToCart,
}: RecordDetailModalProps) {
  if (!record) return null;

  const stockLabel = () => {
    if (!record.stockStatus || record.stockStatus === 'out_of_stock') {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (record.stockStatus === 'low_stock') {
      return <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-0">Low Stock</Badge>;
    }
    return <Badge className="bg-green-600 hover:bg-green-600 text-white border-0">In Stock</Badge>;
  };

  const details = [
    record.label && { label: 'Label', value: record.label },
    record.year && { label: 'Year', value: String(record.year) },
    record.country && { label: 'Country', value: record.country },
    record.formatDetails && { label: 'Format', value: record.formatDetails },
    record.media_condition && { label: 'Media', value: record.media_condition },
    record.sleeve_condition && { label: 'Sleeve', value: record.sleeve_condition },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{record.title || 'Record Details'}</DialogTitle>

        <div className="flex flex-col sm:flex-row">
          {/* Cover image */}
          <div className="relative aspect-square w-full sm:w-[280px] shrink-0 bg-muted">
            {record.cover_url ? (
              <Image
                src={record.cover_url}
                alt={record.title || 'Vinyl Record'}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 280px"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/10">
                <Disc3 className="h-20 w-20 text-muted-foreground/20" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-1 flex-col p-6">
            {/* Title & Artist */}
            <div>
              <h2 className="text-xl font-bold leading-tight">{record.title}</h2>
              {record.artist && (
                <p className="mt-1 text-base text-muted-foreground">{record.artist}</p>
              )}
            </div>

            {/* Genre tags */}
            {record.genre && record.genre.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {record.genre.map((g) => (
                  <Badge key={g} variant="secondary" className="text-xs font-normal">
                    {g}
                  </Badge>
                ))}
                {record.style?.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            )}

            {/* Metadata grid */}
            {details.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2.5">
                {details.map((d) => (
                  <div key={d.label}>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">{d.label}</p>
                    <p className="text-sm">{d.value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tracklist */}
            {record.tracklist && record.tracklist.length > 0 && (
              <div className="mt-5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">Tracklist</p>
                <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
                  {record.tracklist.map((track, i) => (
                    <div key={i} className="flex items-baseline gap-2 text-xs">
                      <span className="shrink-0 text-muted-foreground/50 w-5 text-right">
                        {track.position || i + 1}
                      </span>
                      <span className="flex-1 truncate">{track.title}</span>
                      {track.duration && (
                        <span className="shrink-0 text-muted-foreground/50">{track.duration}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Spacer */}
            <div className="flex-1" />

            {/* Footer: price + stock + cart */}
            <div className="mt-6 flex items-center justify-between gap-4 border-t pt-4">
              <div className="flex items-center gap-3">
                {stockLabel()}
                {isApprovedClient && record.sellingPrice != null && record.sellingPrice >= 0 && (
                  <span className="flex items-center gap-0.5 text-lg font-bold text-primary">
                    <Euro className="h-4 w-4" />
                    {formatPriceForDisplay(record.sellingPrice)}
                  </span>
                )}
              </div>
              {isApprovedClient && onAddToCart && record.stockStatus !== 'out_of_stock' && record.sellingPrice != null && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToCart(record.id);
                    onClose();
                  }}
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Add to Cart
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

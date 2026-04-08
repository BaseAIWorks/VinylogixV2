"use client";

import Image from "next/image";
import { Store } from "lucide-react";

interface StorefrontHeaderProps {
  name: string;
  companyName?: string;
  logoUrl?: string;
  headline?: string;
  description?: string;
}

export default function StorefrontHeader({
  name,
  companyName,
  logoUrl,
  headline,
  description,
}: StorefrontHeaderProps) {
  const displayName = companyName || name;

  return (
    <div className="border-b bg-card">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={displayName}
              width={80}
              height={80}
              className="h-20 w-20 rounded-lg object-contain"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-primary/10">
              <Store className="h-10 w-10 text-primary" />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {displayName}
            </h1>
            {headline && (
              <p className="mt-1 text-lg text-muted-foreground">{headline}</p>
            )}
            {description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

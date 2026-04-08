"use client";

import Image from "next/image";
import Link from "next/link";
import { Store, LogIn, ShoppingCart, UserCircle, ExternalLink, Disc3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

interface StorefrontHeaderProps {
  name: string;
  slug: string;
  companyName?: string;
  logoUrl?: string;
  headline?: string;
  description?: string;
  website?: string;
  recordCount?: number;
}

export default function StorefrontHeader({
  name,
  slug,
  companyName,
  logoUrl,
  headline,
  description,
  website,
  recordCount,
}: StorefrontHeaderProps) {
  const { user, cartCount } = useAuth();
  const displayName = companyName || name;

  return (
    <div className="relative overflow-hidden border-b bg-card">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.06),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.04),transparent_50%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {/* Top bar: actions */}
        <div className="flex items-center justify-end gap-2 mb-6">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="relative">
                <Link href="/cart">
                  <ShoppingCart className="h-4 w-4" />
                  {cartCount > 0 && (
                    <Badge className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[9px]">
                      {cartCount}
                    </Badge>
                  )}
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">
                  <UserCircle className="mr-1.5 h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">
                  <LogIn className="mr-1.5 h-4 w-4" />
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register/client">Register</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Branding */}
        <div className="flex flex-col items-center text-center">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={displayName}
              width={96}
              height={96}
              className="h-20 w-20 rounded-xl object-contain shadow-sm sm:h-24 sm:w-24"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/10 shadow-sm sm:h-24 sm:w-24">
              <Store className="h-10 w-10 text-primary sm:h-12 sm:w-12" />
            </div>
          )}

          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {displayName}
          </h1>

          {headline && (
            <p className="mt-2 max-w-xl text-base text-muted-foreground sm:text-lg">
              {headline}
            </p>
          )}

          {description && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground/80 leading-relaxed">
              {description}
            </p>
          )}

          {/* Meta badges */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {recordCount != null && recordCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                <Disc3 className="h-3 w-3" />
                {recordCount} record{recordCount !== 1 ? 's' : ''}
              </span>
            )}
            {website && (
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

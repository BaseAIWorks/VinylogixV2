"use client";

import Image from "next/image";
import Link from "next/link";
import { Store, LogIn, ShoppingCart, UserCircle } from "lucide-react";
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
}

export default function StorefrontHeader({
  name,
  slug,
  companyName,
  logoUrl,
  headline,
  description,
}: StorefrontHeaderProps) {
  const { user, cartCount } = useAuth();
  const displayName = companyName || name;

  return (
    <div className="border-b bg-card">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
        {/* Top bar: branding left, actions right */}
        <div className="flex items-start justify-between gap-4">
          {/* Branding */}
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={displayName}
                width={80}
                height={80}
                className="h-16 w-16 rounded-lg object-contain sm:h-20 sm:w-20"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 sm:h-20 sm:w-20">
                <Store className="h-8 w-8 text-primary sm:h-10 sm:w-10" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold tracking-tight sm:text-3xl">
                {displayName}
              </h1>
              {headline && (
                <p className="mt-1 text-sm text-muted-foreground sm:text-lg">{headline}</p>
              )}
              {description && (
                <p className="mt-1 hidden max-w-2xl text-sm text-muted-foreground sm:block">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Cart */}
                <Button asChild variant="outline" size="sm" className="relative">
                  <Link href="/cart">
                    <ShoppingCart className="h-4 w-4" />
                    {cartCount > 0 && (
                      <Badge className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]">
                        {cartCount}
                      </Badge>
                    )}
                  </Link>
                </Button>
                {/* User menu / dashboard link */}
                <Button asChild variant="outline" size="sm">
                  <Link href="/dashboard">
                    <UserCircle className="mr-1.5 h-4 w-4" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <Link href={"/login"}>
                  <LogIn className="mr-1.5 h-4 w-4" />
                  Sign in
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { type ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { LogIn, Lock, Loader2 } from "lucide-react";
import Link from "next/link";

interface StorefrontGateProps {
  visibility: "open" | "private" | "invite_only";
  slug: string;
  distributorId: string;
  children: ReactNode;
}

export default function StorefrontGate({
  visibility,
  slug,
  distributorId,
  children,
}: StorefrontGateProps) {
  const { user, loading, clientAccessDistributors } = useAuth();

  // Open storefronts — always render
  if (visibility === "open") {
    return <>{children}</>;
  }

  // Loading auth state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated — show login prompt
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
        <h2 className="mt-4 text-xl font-semibold">
          {visibility === "invite_only"
            ? "Invite-Only Catalog"
            : "Login Required"}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {visibility === "invite_only"
            ? "This catalog is only accessible to invited clients. Log in to check your access."
            : "You need to log in to browse this catalog."}
        </p>
        <Button asChild className="mt-6">
          <Link href={`/login?returnTo=/storefront/${slug}`}>
            <LogIn className="mr-2 h-4 w-4" />
            Log in
          </Link>
        </Button>
      </div>
    );
  }

  // Invite-only: check if the user has access
  if (visibility === "invite_only") {
    const hasAccess =
      user.role === "superadmin" ||
      user.distributorId === distributorId ||
      clientAccessDistributors?.some((d) => d.id === distributorId);

    if (!hasAccess) {
      return (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <Lock className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">Invite Only</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This catalog is only accessible to invited clients. Contact the
            distributor to request access.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      );
    }
  }

  // Authenticated (private or invite_only with access) — render catalog
  return <>{children}</>;
}

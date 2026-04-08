"use client";

import { type ReactNode, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { LogIn, Lock, Loader2, Send, CheckCircle2 } from "lucide-react";
import { auth as firebaseAuth } from "@/lib/firebase";
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
  const { toast } = useToast();
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sending' | 'sent' | 'already_pending'>('idle');

  const handleRequestAccess = useCallback(async () => {
    if (!user || requestStatus !== 'idle') return;
    setRequestStatus('sending');
    try {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) return;
      const token = await currentUser.getIdToken();
      const res = await fetch(`/api/storefront/${slug}/request-access`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setRequestStatus('sent');
        toast({ title: "Request sent", description: "The distributor will review your access request." });
      } else if (res.status === 409) {
        setRequestStatus('already_pending');
      } else {
        setRequestStatus('idle');
        toast({ title: "Error", description: "Could not send request.", variant: "destructive" });
      }
    } catch {
      setRequestStatus('idle');
      toast({ title: "Error", description: "Could not send request.", variant: "destructive" });
    }
  }, [user, requestStatus, slug, toast]);

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
            ? "This catalog is only accessible to invited clients. Sign in to request access."
            : "Sign in to browse this catalog."}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button asChild>
            <Link href="/login">
              <LogIn className="mr-2 h-4 w-4" />
              Sign in
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register/client" className="text-primary hover:underline">
              Register as a client
            </Link>
          </p>
        </div>
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
            This catalog is only accessible to approved clients.
          </p>
          <div className="mt-6">
            {requestStatus === 'sent' || requestStatus === 'already_pending' ? (
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Access request sent — waiting for approval
              </div>
            ) : (
              <Button onClick={handleRequestAccess} disabled={requestStatus === 'sending'}>
                {requestStatus === 'sending' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Request Access
              </Button>
            )}
          </div>
        </div>
      );
    }
  }

  // Authenticated (private or invite_only with access) — render catalog
  return <>{children}</>;
}

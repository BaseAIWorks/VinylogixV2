"use client";

import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  AlertTriangle,
  ArrowLeft,
  CreditCard,
  CheckCircle,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNowStrict } from "date-fns";
import type { SubscriptionInfo, SubscriptionTier, SubscriptionStatus } from "@/types";

const subscriptionStatusColors: Record<string, string> = {
  active: "text-green-500",
  trialing: "text-blue-500",
  past_due: "text-orange-500",
  canceled: "text-red-500",
  incomplete: "text-yellow-500",
};

const DetailItem = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | React.ReactNode;
}) => {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex justify-between items-center py-2 border-b">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
};

// Local mirror of your default tiers so the UI can still work
// even if subscription object isn't stored directly.
const getDefaultTierConfig = (tier: SubscriptionTier): Omit<SubscriptionInfo, "status"> => {
  switch (tier) {
    case "essential":
      return {
        tier: "essential",
        maxRecords: 100,
        maxUsers: 2,
        allowOrders: false,
        allowAiFeatures: false,
        price: 9,
        quarterlyPrice: 25,
        yearlyPrice: 90,
        description: "For personal collectors and enthusiasts getting started.",
        features:
          "Up to 100 records\nPersonal collection tracking\nWishlist management",
      };
    case "growth":
      return {
        tier: "growth",
        maxRecords: 1000,
        maxUsers: 10,
        allowOrders: true,
        allowAiFeatures: false,
        price: 29,
        quarterlyPrice: 79,
        yearlyPrice: 290,
        description: "Ideal for small shops and growing businesses.",
        features:
          "Up to 1,000 records\nOrder Management\nClient Accounts\nBasic Analytics",
      };
    case "scale":
      return {
        tier: "scale",
        maxRecords: -1,
        maxUsers: -1,
        allowOrders: true,
        allowAiFeatures: true,
        price: 79,
        quarterlyPrice: 220,
        yearlyPrice: 790,
        description: "For established distributors and power users.",
        features:
          "Unlimited records\nAI-powered descriptions\nAdvanced Analytics\nPriority Support",
      };
  }
};

export default function SubscriptionPage() {
  const { user, loading: authLoading, activeDistributor } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (user?.role !== "master") {
    return (
      <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          Only Master users can manage subscriptions.
        </p>
        <Button onClick={() => router.push("/dashboard")} className="mt-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard
        </Button>
      </div>
    );
  }

  // Old field (static config on distributor, if any)
  const subscriptionFromDistributor = activeDistributor?.subscription;

  // Stripe-backed fields we wired via webhook
  const distributorTier = activeDistributor?.subscriptionTier as
    | SubscriptionTier
    | undefined;
  const distributorStatus = activeDistributor?.subscriptionStatus as
    | SubscriptionStatus
    | undefined;

  // Build a SubscriptionInfo object either from existing distributor.subscription
  // OR from Stripe-backed tier + status.
  const effectiveSubscription: SubscriptionInfo | null = (() => {
    if (subscriptionFromDistributor) {
      return subscriptionFromDistributor;
    }

    if (!distributorTier) return null;

    const base = getDefaultTierConfig(distributorTier);
    return {
      ...base,
      status: distributorStatus ?? "active",
    };
  })();

  const getTrialDaysLeft = () => {
    if (
      !activeDistributor?.createdAt ||
      effectiveSubscription?.status !== "trialing"
    ) {
      return null;
    }

    const createdAt = new Date(activeDistributor.createdAt);
    const trialEndDate = new Date(
      createdAt.getTime() + 7 * 24 * 60 * 60 * 1000
    );
    const now = new Date();
    const daysLeft = formatDistanceToNowStrict(trialEndDate, { unit: "day" });

    if (now > trialEndDate) {
      return "Trial has expired.";
    }
    return `~${daysLeft} left`;
  };

  const trialDaysLeft = getTrialDaysLeft();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <CreditCard className="h-8 w-8 text-primary" />
            <div>
              <CardTitle className="text-2xl">My Subscription</CardTitle>
              <CardDescription>View and manage your Vinylogix plan.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {activeDistributor?.isSubscriptionExempt ? (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-green-500/10 rounded-lg">
              <ShieldCheck className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-2xl font-bold text-green-600">
                You are on a Managed Plan!
              </h3>
              <p className="text-muted-foreground mt-2">
                Your account is directly managed and is exempt from standard
                billing. <br />
                Contact support for any questions about your plan.
              </p>
            </div>
          ) : effectiveSubscription ? (
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Current Plan</h3>
                <p className="text-4xl font-bold text-primary capitalize">
                  {effectiveSubscription.tier}
                </p>
                <div className="flex items-center gap-2">
                  <p
                    className={`text-lg font-semibold capitalize ${
                      subscriptionStatusColors[effectiveSubscription.status] || ""
                    }`}
                  >
                    {effectiveSubscription.status?.replace("_", " ")}
                  </p>
                  {trialDaysLeft && (
                    <Badge variant="secondary">{trialDaysLeft}</Badge>
                  )}
                </div>
                <Button onClick={() => router.push("/pricing")}>
                  Change Plan
                </Button>
              </div>
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-3">Plan Details</h4>
                <div className="space-y-2">
                  <DetailItem
                    label="Max Records"
                    value={
                      effectiveSubscription.maxRecords === -1
                        ? "Unlimited"
                        : effectiveSubscription.maxRecords.toLocaleString()
                    }
                  />
                  <DetailItem
                    label="Max Users"
                    value={
                      effectiveSubscription.maxUsers === -1
                        ? "Unlimited"
                        : effectiveSubscription.maxUsers.toLocaleString()
                    }
                  />
                  <DetailItem
                    label="Order Management"
                    value={
                      effectiveSubscription.allowOrders ? (
                        <CheckCircle className="text-green-500" />
                      ) : (
                        <XCircle className="text-destructive" />
                      )
                    }
                  />
                  <DetailItem
                    label="AI Features"
                    value={
                      effectiveSubscription.allowAiFeatures ? (
                        <CheckCircle className="text-green-500" />
                      ) : (
                        <XCircle className="text-destructive" />
                      )
                    }
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>No active subscription found.</p>
              <Button
                onClick={() => router.push("/pricing")}
                className="mt-4"
              >
                Choose a Plan
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing & Invoices</CardTitle>
          <CardDescription>Your payment history and details.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
            <p>Payment history and invoice management is coming soon.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

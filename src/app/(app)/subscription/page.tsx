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
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNowStrict, format } from "date-fns";
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
      <div className="text-sm font-medium text-foreground text-right">{value}</div>
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
        maxRecords: -1, // -1 for unlimited
        maxUsers: -1, // -1 for unlimited
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

  // Use the new Stripe-synced fields first
  const distributorTier = activeDistributor?.subscriptionTier;
  const distributorStatus = activeDistributor?.subscriptionStatus;
  const billingCycle = activeDistributor?.billingCycle;
  const periodEnd = activeDistributor?.subscriptionCurrentPeriodEnd;

  const effectiveSubscription: SubscriptionInfo | null = distributorTier
    ? {
        ...getDefaultTierConfig(distributorTier),
        status: distributorStatus ?? "incomplete",
      }
    : activeDistributor?.subscription ?? null;

  const getTrialDaysLeft = () => {
    if (distributorStatus !== "trialing" || !periodEnd) {
      return null;
    }
    const trialEndDate = new Date(periodEnd);
    const now = new Date();
    const daysLeft = formatDistanceToNowStrict(trialEndDate, { unit: "day" });

    if (now > trialEndDate) {
      return "Trial has expired.";
    }
    return `~${daysLeft} left`;
  };

  const trialDaysLeft = getTrialDaysLeft();

  const handleManageSubscription = () => {
    // This will redirect the user to a pre-built Stripe page to manage their subscription.
    // Replace with your actual Stripe Customer Portal link from your Stripe dashboard settings.
    window.location.href = 'https://billing.stripe.com/p/login/YOUR_PORTAL_ID';
  }


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
                <div className="space-x-2">
                   <Button onClick={handleManageSubscription}>
                      Manage Billing <ExternalLink className="ml-2 h-4 w-4" />
                   </Button>
                   <Button onClick={() => router.push("/pricing")} variant="outline">
                     Change Plan
                   </Button>
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="font-semibold mb-3">Plan Details</h4>
                <div className="space-y-2">
                   {billingCycle && <DetailItem label="Billing Cycle" value={<span className="capitalize">{billingCycle}</span>} />}
                   {periodEnd && effectiveSubscription.status !== 'canceled' && (
                     <DetailItem 
                        label={effectiveSubscription.status === 'trialing' ? 'Trial Ends' : 'Next Billing Date'} 
                        value={format(new Date(periodEnd), 'PPP')} 
                     />
                   )}
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
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Flame, Calculator, ScanLine, BarChart3, Users, Building, Gift, Clock, Minus, Zap, Shield, Disc3, Heart, Store, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getSubscriptionTiers } from "@/services/client-subscription-service";
import type { SubscriptionInfo, SubscriptionTier } from "@/types";
import { DistributorTiers } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { formatPriceForDisplay } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Tier display config. Fee label is derived dynamically from the live tier
// data on save — admin edits transactionFeePercent in /admin/settings.
const tierConfig: Record<string, { label: string; badge?: string; badgeVariant?: string; ctaLabel: string }> = {
  payg: { label: "Pay as you go", ctaLabel: "Start Free" },
  essential: { label: "Essential", ctaLabel: "Start Free Trial" },
  growth: { label: "Growth", badge: "Most Popular", ctaLabel: "Start Free Trial" },
  scale: { label: "Scale", badge: "Best Value", badgeVariant: "outline", ctaLabel: "Start Free Trial" },
};

const PricingTierComponent = ({
  tierName,
  tier,
  billingCycle,
  isPopular,
  onChoosePlan,
}: {
  tierName: string;
  tier: SubscriptionInfo;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  isPopular?: boolean;
  onChoosePlan: (tier: SubscriptionTier) => void;
}) => {
  const config = tierConfig[tierName] || { label: tierName, ctaLabel: "Get Started" };
  const isPayg = tier.tier === 'payg';
  const isScale = tier.tier === 'scale';
  // Derive fee label from live transactionFeePercent. Fallback "—" if undefined.
  const feeLabel =
    typeof tier.transactionFeePercent === 'number'
      ? `${tier.transactionFeePercent}% per sale`
      : '';

  let price: number | undefined;
  let priceDetails: string = '';
  let perMonthPrice: string | null = null;
  let savingsText: string | null = null;

  if (isPayg) {
    price = 0;
    priceDetails = '';
  } else {
    switch (billingCycle) {
      case 'quarterly':
        price = tier.quarterlyPrice;
        priceDetails = '/3 months';
        if (tier.price && tier.quarterlyPrice) {
          perMonthPrice = `€${(tier.quarterlyPrice / 3).toFixed(2)}/mo`;
          const savings = (tier.price * 3) - tier.quarterlyPrice;
          if (savings > 0) savingsText = `Save €${savings.toFixed(0)}`;
        }
        break;
      case 'yearly':
        price = tier.yearlyPrice;
        priceDetails = '/year';
        if (tier.price && tier.yearlyPrice) {
          perMonthPrice = `€${(tier.yearlyPrice / 12).toFixed(2)}/mo`;
          const savings = (tier.price * 12) - tier.yearlyPrice;
          if (savings > 0) savingsText = `Save €${savings.toFixed(0)}`;
        }
        break;
      default:
        price = tier.price;
        priceDetails = '/month';
        break;
    }
  }

  // Records limit is driven by tier.maxRecords (admin-editable number), not by
  // the free-text features string. Strip any existing records-mentioning line
  // AND any line mentioning transaction fees (e.g. "4% transaction fee") — both
  // are now auto-derived, so we avoid duplication if old Firestore data still
  // contains them.
  const recordsLabel =
    tier.maxRecords === -1
      ? 'Unlimited records'
      : `Up to ${tier.maxRecords.toLocaleString()} records`;
  const rawFeatures = tier.features
    ? tier.features.split('\n').map(f => f.trim()).filter(Boolean)
    : [];
  const features = [
    recordsLabel,
    ...rawFeatures.filter(f => !/records?/i.test(f) && !/transaction\s*fee|per\s*sale|%\s*fee/i.test(f)),
  ];

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col rounded-2xl border p-6 transition-all duration-300',
        isPopular
          ? 'border-primary bg-primary/[0.03] shadow-xl shadow-primary/10 ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/30 hover:shadow-lg',
      )}
    >
      {/* Badge */}
      {config.badge && (
        <div className="absolute -top-3 left-6">
          <Badge
            className={cn(
              "px-3 py-1 text-xs font-semibold",
              isPopular
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-primary/40 text-primary"
            )}
            variant={isPopular ? "default" : "outline"}
          >
            {isPopular && <Flame className="mr-1 h-3 w-3" />}
            {config.badge}
          </Badge>
        </div>
      )}

      <div className="flex-1">
        {/* Tier name */}
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {config.label}
        </h3>

        {/* Price */}
        <div className="mt-4 flex items-baseline gap-1">
          {price !== undefined ? (
            isPayg ? (
              <>
                <span className="text-4xl font-bold tracking-tight">€0</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </>
            ) : (
              <>
                <span className="text-4xl font-bold tracking-tight">€{price}</span>
                <span className="text-sm text-muted-foreground">{priceDetails}</span>
              </>
            )
          ) : (
            <Skeleton className="h-10 w-28" />
          )}
        </div>

        {/* Per-month breakdown or savings */}
        <div className="mt-1 h-5">
          {savingsText && (
            <span className="text-sm font-medium text-green-600 dark:text-green-400">{savingsText}</span>
          )}
          {perMonthPrice && !savingsText && (
            <span className="text-xs text-muted-foreground">{perMonthPrice}</span>
          )}
        </div>

        {/* Fee badge */}
        {feeLabel && (
          <div className="mt-4">
            <span className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              isPayg
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                : "bg-muted text-muted-foreground"
            )}>
              {feeLabel}
            </span>
          </div>
        )}

        {/* Description */}
        <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
          {tier.description || <Skeleton className="h-4 w-full" />}
        </p>

        {/* Features */}
        <ul className="mt-6 space-y-2.5">
          {features.length > 0 ? features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm text-foreground/80">{feature}</span>
            </li>
          )) : (
            <>
              {[...Array(3)].map((_, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Skeleton className="h-4 w-4 rounded shrink-0" />
                  <Skeleton className="h-4 w-full" />
                </li>
              ))}
            </>
          )}
        </ul>
      </div>

      {/* CTA */}
      <Button
        size="lg"
        className={cn(
          "mt-8 w-full transition-all",
          isPopular ? "" : "bg-foreground text-background hover:bg-foreground/90",
        )}
        variant={isPopular ? "default" : "outline"}
        onClick={() => onChoosePlan(tier.tier)}
      >
        {config.ctaLabel}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>

      {/* Trial note */}
      {!isPayg && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          7-day free trial included
        </p>
      )}
    </div>
  );
};


export default function PricingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [tiers, setTiers] = useState<Record<SubscriptionTier, SubscriptionInfo> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTiers = async () => {
      setIsLoading(true);
      try {
        const data = await getSubscriptionTiers();
        setTiers(data);
      } catch (error) {
        console.error("Failed to load subscription tiers", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTiers();
  }, []);

  const handleChoosePlan = (tier: SubscriptionTier) => {
    // Defensive gate: inactive tiers are already filtered from display, but a
    // racing admin deactivation after page-load could still leak through.
    // Surface a toast rather than funnelling the user into a dead-end flow.
    if (tiers && tiers[tier] && tiers[tier].isActive === false) {
      toast({
        title: 'Plan unavailable',
        description: 'This plan is no longer accepting new customers. Please choose another.',
        variant: 'destructive',
      });
      return;
    }

    if (tier === 'payg') {
      router.push('/register?tier=payg');
      return;
    }
    const params = new URLSearchParams();
    params.set('tier', tier);
    params.set('billing', billingCycle);
    router.push(`/register?${params.toString()}`);
  };

  // Fee comparison data (Growth tier as example).
  // Uses the live Growth transactionFeePercent so the comparison stays in sync
  // with admin edits. Falls back to 3% if not yet loaded.
  const growthFeeRate =
    typeof tiers?.growth?.transactionFeePercent === 'number'
      ? tiers.growth.transactionFeePercent / 100
      : 0.03;
  const salePrice = 500.00;
  const shippingCost = 15.00;
  const orderTotal = salePrice + shippingCost;
  const stripeFee = orderTotal * 0.015 + 0.25;
  const vinylogixFee = salePrice * growthFeeRate;
  const vinylogixTotalFee = stripeFee + vinylogixFee;
  const otherPlatformFee = orderTotal * 0.09;
  const otherPlatformPaymentFee = orderTotal * 0.034 + 0.35;
  const otherPlatformTotalFee = otherPlatformFee + otherPlatformPaymentFee;
  const savings = otherPlatformTotalFee - vinylogixTotalFee;

  return (
    <>
      {/* Hero */}
        <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
          </div>

          <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Gift className="h-4 w-4" />
              7-day free trial on all paid plans
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Simple, transparent pricing
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              Start free with pay-as-you-go, or pick a plan that scales with your business. No hidden fees, cancel anytime.
            </p>

            {/* Billing toggle */}
            <div className="mt-10 flex justify-center">
              <RadioGroup
                defaultValue="monthly"
                onValueChange={(v) => setBillingCycle(v as any)}
                className="inline-flex items-center rounded-full border bg-card p-1 shadow-sm"
              >
                {(['monthly', 'quarterly', 'yearly'] as const).map((cycle) => (
                  <div key={cycle}>
                    <RadioGroupItem value={cycle} id={cycle} className="peer sr-only" />
                    <Label
                      htmlFor={cycle}
                      className={cn(
                        "cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition-all",
                        "peer-data-[state=checked]:bg-foreground peer-data-[state=checked]:text-background peer-data-[state=checked]:shadow-sm",
                        "hover:bg-muted"
                      )}
                    >
                      {cycle === 'quarterly' ? 'Quarterly' : cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                      {cycle === 'yearly' && (
                        <span className="ml-1.5 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:text-green-300">
                          SAVE
                        </span>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-8 sm:py-12">
          <div className="container mx-auto max-w-6xl px-4">
            {(() => {
              const activeTiers = tiers
                ? DistributorTiers.filter(k => tiers[k] && tiers[k].isActive !== false)
                : [];
              const count = activeTiers.length || 4; // 4 during loading
              const gridCols =
                count <= 1 ? 'lg:grid-cols-1 max-w-sm mx-auto'
                : count === 2 ? 'lg:grid-cols-2 max-w-3xl mx-auto'
                : count === 3 ? 'lg:grid-cols-3 max-w-5xl mx-auto'
                : 'lg:grid-cols-4';
              return (
            <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 ${gridCols}`}>
              {isLoading || !tiers ? (
                [...Array(4)].map((_, i) => (
                  <div key={i} className="flex flex-col rounded-2xl border p-6 space-y-4">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-10 w-2/5" />
                    <Skeleton className="h-4 w-full" />
                    <div className="pt-4 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <Skeleton className="h-11 w-full mt-auto" />
                  </div>
                ))
              ) : (
                DistributorTiers.map(tierKey => {
                  const t = tiers[tierKey];
                  // Hide tiers admin has deactivated. undefined isActive = active.
                  if (!t || t.isActive === false) return null;
                  return (
                    <PricingTierComponent
                      key={tierKey}
                      tierName={tierKey}
                      tier={t}
                      billingCycle={billingCycle}
                      isPopular={tierKey === 'growth'}
                      onChoosePlan={handleChoosePlan}
                    />
                  );
                })
              )}
            </div>
              );
            })()}

          </div>
        </section>

        {/* Account comparison — collector vs shop/distributor */}
        <section className="py-16 sm:py-20 border-t">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Which account is right for you?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Vinylogix serves two audiences. Pick the one that fits — you can always upgrade later.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {/* Collector account */}
              <div className="relative flex flex-col rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:border-primary/30 hover:shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2.5">
                      <Heart className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Collector account</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-700 dark:text-green-400">
                    <Sparkles className="h-3 w-3" />
                    Free forever
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">€0</span>
                  <span className="text-sm text-muted-foreground">/month · no credit card</span>
                </div>

                <div className="mt-5 rounded-lg bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Best for</p>
                  <p className="mt-1 text-sm text-foreground/90">
                    Vinyl enthusiasts and personal collectors who want to track their own collection, build a wishlist, and buy from distributors and record shops.
                  </p>
                </div>

                <ul className="mt-6 space-y-2.5">
                  {[
                    'Unlimited personal collection — add as many records as you want',
                    'Wishlist, favorites and advanced search across your library',
                    'Import and sync your collection from Discogs',
                    'Barcode scanning to add records in seconds',
                    'Browse catalogs from distributors and record shops',
                    'Request access to any shop to see prices and place orders',
                    'Full order history and shipment tracking',
                    'Personal profile with shipping addresses',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-lg border border-dashed border-muted-foreground/20 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/90">Note:</span> collector accounts don&apos;t sell records. To list inventory and accept orders, choose a Shop &amp; Distributor plan.
                </div>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="mt-8 w-full bg-foreground text-background hover:bg-foreground/90"
                >
                  <Link href="/get-started?role=collector">
                    Create free collector account
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Shop / distributor account */}
              <div className="relative flex flex-col rounded-2xl border border-primary/30 bg-primary/[0.03] p-6 sm:p-8 shadow-xl shadow-primary/10 ring-1 ring-primary/20 transition-all">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-primary/10 p-2.5">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Shop &amp; Distributor account</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <Gift className="h-3 w-3" />
                    7-day free trial
                  </span>
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    From €0
                  </span>
                  <span className="text-sm text-muted-foreground">/month · pay-as-you-go available</span>
                </div>

                <div className="mt-5 rounded-lg bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Best for</p>
                  <p className="mt-1 text-sm text-foreground/90">
                    Record stores, distributors, wholesalers and independent sellers who want to manage inventory, run a branded storefront, and sell to collectors and other shops.
                  </p>
                </div>

                <ul className="mt-6 space-y-2.5">
                  {[
                    'Full inventory management with locations, stock and supplier tracking',
                    'Custom branded storefront with your logo and public catalog',
                    'Barcode scanning + AI-powered product descriptions (Scale)',
                    'Client CRM — invite buyers, control access, manage wishlists',
                    'Order fulfillment, shipping zones, rates and tax configuration',
                    'Built-in payments via Stripe Connect (cards, SEPA, more)',
                    'Sales analytics, inventory value and customer insights',
                    'Multi-staff roles (Master / Worker) with custom permissions',
                  ].map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-lg border border-dashed border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/90">Record limits scale with your plan:</span> from 50 records on Pay-as-you-go up to unlimited on Scale. See the plans above.
                </div>

                <Button
                  size="lg"
                  className="mt-8 w-full"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  Compare shop plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Fee comparison */}
        <section className="py-16 sm:py-24">
          <div className="container mx-auto max-w-5xl px-4">
            <div className="text-center">
              <div className="inline-flex rounded-full bg-primary/10 p-3 mb-4">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Keep more of every sale
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                See exactly how much you save compared to other platforms. Example based on a €{formatPriceForDisplay(salePrice)} record + €{formatPriceForDisplay(shippingCost)} shipping.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              {/* Vinylogix card */}
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/[0.02] p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Disc3 className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">Vinylogix <span className="text-sm font-normal text-muted-foreground">(Growth plan)</span></h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform fee (3% on item)</span>
                    <span className="font-medium">-€{formatPriceForDisplay(vinylogixFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment processing (1.5% + €0.25)</span>
                    <span className="font-medium">-€{formatPriceForDisplay(stripeFee)}</span>
                  </div>
                  <div className="my-3 border-t" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total fees</span>
                    <span className="font-semibold">€{formatPriceForDisplay(vinylogixTotalFee)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2">
                    <span className="font-semibold text-base">Your payout</span>
                    <span className="text-2xl font-bold text-primary">€{formatPriceForDisplay(orderTotal - vinylogixTotalFee)}</span>
                  </div>
                </div>
              </div>

              {/* Other platforms card */}
              <div className="rounded-2xl border bg-card p-6 sm:p-8 opacity-75">
                <div className="flex items-center gap-3 mb-6">
                  <div className="rounded-full bg-muted p-2">
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-muted-foreground">Other platforms</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform fee (~9% on total)</span>
                    <span className="font-medium">-€{formatPriceForDisplay(otherPlatformFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment processing (3.4% + €0.35)</span>
                    <span className="font-medium">-€{formatPriceForDisplay(otherPlatformPaymentFee)}</span>
                  </div>
                  <div className="my-3 border-t" />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total fees</span>
                    <span className="font-semibold">€{formatPriceForDisplay(otherPlatformTotalFee)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-2">
                    <span className="font-semibold text-base">Your payout</span>
                    <span className="text-2xl font-bold">€{formatPriceForDisplay(orderTotal - otherPlatformTotalFee)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Savings callout */}
            <div className="mt-8 mx-auto max-w-lg rounded-xl border border-green-500/20 bg-green-500/5 p-5 text-center">
              <p className="text-sm text-muted-foreground">You save on this sale</p>
              <p className="mt-1 text-3xl font-bold text-green-600 dark:text-green-400">€{formatPriceForDisplay(savings)}</p>
              <p className="mt-1 text-xs text-muted-foreground">per transaction compared to other platforms</p>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="py-16 sm:py-24 border-t">
          <div className="container mx-auto max-w-5xl px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to run your record business
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Professional tools included with every plan — no marketplace middleman.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: ScanLine, title: "Inventory Tools", desc: "Barcode scanning, AI descriptions, detailed stock management" },
                { icon: Building, title: "Your Brand", desc: "Custom storefront with your logo, name, and public catalog" },
                { icon: BarChart3, title: "Analytics", desc: "Sales insights, inventory value, customer behavior trends" },
                { icon: Users, title: "Client CRM", desc: "Manage clients, wishlists, access control, and order history" },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border bg-card p-5 transition-colors hover:bg-muted/50">
                  <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 sm:py-24 bg-muted/30 border-t">
          <div className="container mx-auto max-w-2xl px-4 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">Ready to get started?</h2>
            <p className="mt-3 text-muted-foreground">
              Start with pay-as-you-go for free, or try any paid plan free for 7 days.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" onClick={() => handleChoosePlan('payg' as SubscriptionTier)}>
                Start Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                Compare Plans
              </Button>
            </div>
          </div>
        </section>
    </>
  );
}

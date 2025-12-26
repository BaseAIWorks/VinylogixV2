
"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Check, Flame, Instagram, Facebook, Twitter, Linkedin, Percent, Calculator, Building, Bot, ScanLine, BarChart3, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getSubscriptionTiers } from "@/services/client-subscription-service";
import type { SubscriptionInfo, SubscriptionTier } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPriceForDisplay } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


const PageHeader = () => {
    const { user } = useAuth();
    const router = useRouter();
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm">
            <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
                <Link href="/" className="flex items-center gap-2">
                    <Image src="/logo.png" alt="Vinylogix Logo" width={180} height={36} style={{ width: 'auto', height: 'auto', maxHeight: '36px' }} className="object-contain" unoptimized={true} />
                </Link>
                <div className="hidden items-center gap-4 md:flex">
                    <Button variant="ghost" onClick={() => router.push('/features')}>Features</Button>
                    <Button variant="ghost" onClick={() => router.push('/pricing')}>Pricing</Button>
                </div>
                <div className="flex items-center gap-2">
                    {user ? (
                        <Button onClick={() => router.push('/dashboard')}>Dashboard</Button>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => router.push('/login')}>Log In</Button>
                            <Button onClick={() => router.push('/register')}>Sign Up</Button>
                        </>
                    )}
                </div>
            </div>
        </header>
    )
};


const PageFooter = () => {
    const footerLinks = {
        Product: [
            { href: "/features", text: "Features" },
            { href: "/pricing", text: "Pricing" },
            { href: "/#", text: "Changelog" },
        ],
        Company: [
            { href: "/#", text: "About" },
            { href: "/#", text: "Team" },
            { href: "/#", text: "Blog" },
        ],
        Resources: [
            { href: "/#", text: "Contact" },
            { href: "/#", text: "Support" },
            { href: "/#", text: "Privacy" },
        ],
    };

    return (
    <footer className="border-t bg-background">
        <div className="container mx-auto max-w-7xl px-4 py-12">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="lg:col-span-1">
                <div className="flex items-center gap-2">
                    <Image src="/logo.png" alt="Vinylogix Logo" width={150} height={30} className="h-auto w-auto max-h-[30px]" unoptimized={true} />
                </div>
                <p className="mt-4 max-w-xs text-muted-foreground">
                The ultimate platform for vinyl record stores and collectors to manage their inventory and passion.
                </p>
                <div className="mt-6 flex gap-4">
                <a href="/#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Instagram"><Instagram className="h-6 w-6" /></a>
                <a href="/#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Facebook"><Facebook className="h-6 w-6" /></a>
                <a href="/#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Twitter"><Twitter className="h-6 w-6" /></a>
                <a href="/#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="LinkedIn"><Linkedin className="h-6 w-6" /></a>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 lg:col-span-3 sm:grid-cols-3">
                {Object.entries(footerLinks).map(([title, links]) => (
                    <div key={title}>
                        <p className="font-semibold text-foreground">{title}</p>
                        <nav className="mt-4 flex flex-col space-y-2 text-sm text-muted-foreground">
                            {links.map((link) => (
                                <Link key={link.text} href={link.href} className="hover:text-foreground">{link.text}</Link>
                            ))}
                        </nav>
                    </div>
                ))}
            </div>
            </div>
            
            <div className="mt-12 border-t pt-8">
            <div className="flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
                <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Vinylogix. All rights reserved.</p>
                <div className="flex gap-4 text-sm text-muted-foreground">
                    <Link href="/#" className="hover:text-foreground">Terms & Conditions</Link>
                    <Link href="/#" className="hover:text-foreground">Privacy Policy</Link>
                </div>
            </div>
            </div>
        </div>
    </footer>
    )
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
    const isFree = tier.tier === 'essential';

    let price: number | undefined;
    let priceDetails: string = '';
    let savingsText: string | null = null;
    
    switch (billingCycle) {
        case 'quarterly':
            price = tier.quarterlyPrice;
            priceDetails = '/3 months';
            if (tier.price && tier.quarterlyPrice) {
                const monthlyTotal = tier.price * 3;
                const savings = monthlyTotal - tier.quarterlyPrice;
                if (savings > 0) savingsText = `Save €${savings.toFixed(0)} every 3 months!`;
            }
            break;
        case 'yearly':
            price = tier.yearlyPrice;
            priceDetails = '/year';
            if (tier.price && tier.yearlyPrice) {
                const monthlyTotal = tier.price * 12;
                const savings = monthlyTotal - tier.yearlyPrice;
                if (savings > 0) savingsText = `Save €${savings.toFixed(0)} a year!`;
            }
            break;
        case 'monthly':
        default:
            price = tier.price;
            priceDetails = '/month';
            break;
    }
    
    return (
        <div
            className={cn(
                'relative flex h-full flex-col rounded-2xl border p-8 shadow-lg',
                isPopular ? 'border-primary ring-2 ring-primary' : 'border-border',
                'bg-card text-card-foreground'
            )}
        >
            {isPopular && (
                <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground flex items-center gap-1">
                    <Flame className="h-4 w-4" />
                    Most Popular
                </div>
            )}
            <div className="flex-1">
                <h3 className="text-xl font-semibold capitalize">{tierName}</h3>
                
                <div className="mt-6">
                  {price !== undefined ? (
                    <>
                      <span className="text-5xl font-bold tracking-tight">€{price}</span>
                      {priceDetails && <span className="text-sm font-medium text-muted-foreground">{priceDetails}</span>}
                    </>
                  ) : <Skeleton className="h-12 w-32" />}
                </div>
                {savingsText && (
                    <p className="text-sm font-semibold text-primary mt-2">{savingsText}</p>
                )}
                
                <p className="mt-6 text-muted-foreground min-h-[40px]">
                  {tier.description || <Skeleton className="h-5 w-4/5" />}
                </p>

                <ul role="list" className="mt-8 space-y-4 text-left">
                    {tier.features ? tier.features.split('\n').map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                            <Check className="h-6 w-6 shrink-0 text-primary" />
                            <span className="text-muted-foreground">{feature}</span>
                        </li>
                    )) : (
                        <>
                          <li className="flex items-start gap-3"><Check className="h-6 w-6 shrink-0 text-muted-foreground/50" /><Skeleton className="h-5 w-3/4"/></li>
                          <li className="flex items-start gap-3"><Check className="h-6 w-6 shrink-0 text-muted-foreground/50" /><Skeleton className="h-5 w-full"/></li>
                          <li className="flex items-start gap-3"><Check className="h-6 w-6 shrink-0 text-muted-foreground/50" /><Skeleton className="h-5 w-1/2"/></li>
                        </>
                    )}
                </ul>
            </div>
            <Button
                size="lg"
                className="mt-8 w-full"
                onClick={() => onChoosePlan(tier.tier)}
            >
                Get Started with {tierName.charAt(0).toUpperCase() + tierName.slice(1)} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
    );
};

const FeatureListItem = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary p-3 rounded-full flex-shrink-0 mt-1">
            <Icon className="h-6 w-6" />
        </div>
        <div>
            <h4 className="text-lg font-semibold text-foreground">{title}</h4>
            <p className="text-muted-foreground">{description}</p>
        </div>
    </div>
);


export default function PricingPage() {
    const router = useRouter();
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
        const params = new URLSearchParams();
        params.set('tier', tier);
        params.set('billing', billingCycle);
        router.push(`/register?${params.toString()}`);
    }

    // Example calculation data
    const salePrice = 500.00;
    const stripeFee = salePrice * 0.029 + 0.30;
    const vinylogixFee = salePrice * 0.02;
    const vinylogixTotalFee = stripeFee + vinylogixFee;
    const otherPlatformFee = salePrice * 0.09;
    const otherPlatformPaymentFee = salePrice * 0.0349 + 0.35; // Example based on common payment processor
    const otherPlatformTotalFee = otherPlatformFee + otherPlatformPaymentFee;

    const otherFeatures = [
        { icon: ScanLine, title: "Advanced Inventory Tools", description: "Utilize barcode scanning, AI content generation, and detailed stock management beyond what standard marketplaces offer." },
        { icon: Building, title: "Your Own Branded Space", description: "Operate under your own name and logo, building your brand identity directly with your customers." },
        { icon: BarChart3, title: "In-Depth Analytics", description: "Gain insights into your sales, inventory value, and customer behavior to make smarter business decisions." },
        { icon: Users, title: "Direct Client Relationships", description: "Manage your client base, view their wishlists, and build lasting relationships without a marketplace intermediary." },
    ];

    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <PageHeader/>

        <main className="flex-grow">
            <section className="relative overflow-hidden py-24 md:py-32 text-center text-white">
                 <div className="absolute inset-0 z-0 h-full w-full bg-slate-900">
                    <Image
                        src="/Background-3.png"
                        alt="Vinyl records on display in a store"
                        fill
                        className="object-cover opacity-20"
                        data-ai-hint="record store"
                    />
                 </div>
                 <div className="container mx-auto px-4 relative z-10">
                    <h1 className="text-5xl font-extrabold tracking-tight text-white">Find the Perfect Plan for Your Collection</h1>
                    <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-300">Whether you're a passionate collector or a growing record store, we have a plan that fits your needs. No hidden fees, cancel anytime.</p>
                </div>
            </section>
        
            <div className="py-16 sm:py-20">
              <div className="container mx-auto px-4">
                  <div className="flex justify-center items-center gap-4">
                    <RadioGroup defaultValue="monthly" onValueChange={(value) => setBillingCycle(value as any)} className="grid grid-cols-3 gap-4">
                        <div>
                            <RadioGroupItem value="monthly" id="monthly" className="peer sr-only" />
                            <Label htmlFor="monthly" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Monthly
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="quarterly" id="quarterly" className="peer sr-only" />
                            <Label htmlFor="quarterly" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Quarterly
                            </Label>
                        </div>
                         <div>
                            <RadioGroupItem value="yearly" id="yearly" className="peer sr-only" />
                            <Label htmlFor="yearly" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Yearly
                            </Label>
                        </div>
                    </RadioGroup>
                  </div>

                  <div className="isolate mx-auto mt-10 grid max-w-md grid-cols-1 gap-8 md:max-w-2xl lg:max-w-5xl lg:grid-cols-3">
                      {isLoading || !tiers ? (
                          [...Array(3)].map((_, i) => (
                             <div key={i} className="flex flex-col rounded-2xl border p-8 space-y-4">
                                  <Skeleton className="h-6 w-2/5" />
                                  <Skeleton className="h-12 w-3/5" />
                                  <Skeleton className="h-5 w-4/5" />
                                  <div className="pt-4 space-y-3">
                                      <Skeleton className="h-5 w-full" />
                                      <Skeleton className="h-5 w-3/4" />
                                      <Skeleton className="h-5 w-full" />
                                  </div>
                                  <Skeleton className="h-12 w-full mt-auto" />
                             </div>
                          ))
                      ) : (
                          (['essential', 'growth', 'scale'] as SubscriptionTier[]).map(tierKey => (
                               <PricingTierComponent 
                                  key={tierKey}
                                  tierName={tierKey}
                                  tier={tiers[tierKey]}
                                  billingCycle={billingCycle}
                                  isPopular={tierKey === 'growth'}
                                  onChoosePlan={handleChoosePlan}
                               />
                          ))
                      )}
                  </div>
              </div>
            </div>

            <section className="py-16 sm:py-24">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">More Than Just a Marketplace</h2>
                        <p className="mt-4 text-lg text-muted-foreground">
                            We provide a full suite of professional tools to manage and grow your entire business, not just list items for sale.
                        </p>
                    </div>
                    <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
                        {otherFeatures.map(feature => (
                            <FeatureListItem key={feature.title} {...feature} />
                        ))}
                    </div>
                </div>
            </section>

            <section className="py-16 sm:py-24 bg-primary/5 dark:bg-primary/10">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto">
                         <div className="inline-flex bg-primary/10 text-primary p-3 rounded-full mb-4">
                            <Calculator className="h-8 w-8" />
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">Transparent Transaction Fees</h2>
                        <p className="mt-4 text-lg text-muted-foreground">
                            We believe in clear pricing. Beyond your subscription, you only pay for what you sell, and you'll still keep more of your money compared to other platforms.
                        </p>
                    </div>

                    <div className="mt-16 grid lg:grid-cols-2 gap-8 items-center">
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle>Fee Breakdown</CardTitle>
                                <CardDescription>Example based on a €{formatPriceForDisplay(salePrice)} record sale.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Item</TableHead>
                                            <TableHead className="text-center">Vinylogix</TableHead>
                                            <TableHead className="text-center">Other Platforms</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow>
                                            <TableCell className="font-medium">Record Sale Price</TableCell>
                                            <TableCell className="text-center">€{formatPriceForDisplay(salePrice)}</TableCell>
                                            <TableCell className="text-center">€{formatPriceForDisplay(salePrice)}</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Platform Fee</TableCell>
                                            <TableCell className="text-center">2% (€{formatPriceForDisplay(vinylogixFee)})</TableCell>
                                            <TableCell className="text-center">~9% (€{formatPriceForDisplay(otherPlatformFee)})</TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell>Payment Processing</TableCell>
                                            <TableCell className="text-center">~2.9% + €0.30 (Stripe)</TableCell>
                                            <TableCell className="text-center">~3.5% + €0.35 (e.g. PayPal)</TableCell>
                                        </TableRow>
                                        <TableRow className="font-bold bg-muted/50">
                                            <TableCell>Total Fees</TableCell>
                                            <TableCell className="text-center">€{formatPriceForDisplay(vinylogixTotalFee)}</TableCell>
                                            <TableCell className="text-center">€{formatPriceForDisplay(otherPlatformTotalFee)}</TableCell>
                                        </TableRow>
                                        <TableRow className="font-bold text-lg text-primary">
                                            <TableCell>Your Payout</TableCell>
                                            <TableCell className="text-center">€{formatPriceForDisplay(salePrice - vinylogixTotalFee)}</TableCell>
                                            <TableCell className="text-center">€{formatPriceForDisplay(salePrice - otherPlatformTotalFee)}</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                                <p className="text-xs text-muted-foreground mt-4">*Payment processing fees are estimates and may vary. Other platforms often require a separate payment provider (e.g., PayPal), whose fees come on top of the platform fee.</p>
                            </CardContent>
                        </Card>
                         <div className="space-y-4">
                            <h3 className="text-2xl font-bold">Keep More, Earn More.</h3>
                            <p className="text-muted-foreground">
                                With Vinylogix, your subscription fee unlocks powerful tools, and our low transaction fee means you take home more from every single sale. Over time, the savings add up, allowing you to reinvest in what you love: more great records.
                            </p>
                            <div className="p-6 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-300">
                                <p className="font-bold text-2xl">
                                    Savings on this sale: €{formatPriceForDisplay(otherPlatformTotalFee - vinylogixTotalFee)}
                                </p>
                                <p>That's a significant reduction in fees compared to the competition!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
        
        <PageFooter/>
      </div>
    );
}


"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper, Step, StepIndicator, StepStatus, StepNumber, StepTitle, useSteps, StepIcon } from "@/components/ui/stepper";
import { Check, Loader2, Building, User, Key, ArrowRight, AlertTriangle, Eye, EyeOff, Gift, Pencil } from "lucide-react";
import React, { useState, useEffect, Suspense } from "react";
import type { SubscriptionTier, SubscriptionInfo } from '@/types';
import { getSubscriptionTiers } from '@/services/client-subscription-service';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

// --- Form Schemas ---
const companySchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  kvkNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  website: z.string().optional(),
});

const personSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
});

// Create a single combined schema for the whole form
const formSchema = companySchema.merge(personSchema).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type OnboardingFormValues = z.infer<typeof formSchema>;

// --- Step Definitions ---
const steps = [
  { label: "Company", icon: Building, fields: ["companyName", "kvkNumber", "vatNumber", "website"] as const },
  { label: "Your Details", icon: User, fields: ["firstName", "lastName", "email", "password", "confirmPassword"] as const },
  { label: "Subscribe", icon: Key },
];

// sessionStorage key for persisting draft form state across refreshes
// and OAuth round-trips. Cleared on successful Stripe redirect by
// auth-context finalizeRegistration.
const DRAFT_STORAGE_KEY = 'vinylogix_register_draft';

interface StoredDraft {
  values: Partial<OnboardingFormValues>;
  activeStep: number;
  tier: string;
  billing: string;
}

// ---------------------------------------------------------------------------
// Step content
// ---------------------------------------------------------------------------

const StepContent = ({ activeStep, form, tier, billing }: {
    activeStep: number;
    form: UseFormReturn<OnboardingFormValues>;
    tier: string;
    billing: string;
}) => {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Watch password fields for live matching validation
    const password = form.watch("password");
    const confirmPassword = form.watch("confirmPassword");
    const passwordsMatch = password && confirmPassword && password === confirmPassword;
    const showMismatch = confirmPassword && confirmPassword.length > 0 && password !== confirmPassword;

    switch (activeStep) {
        case 0:
            return (
                <div className="space-y-4">
                    <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} placeholder="Your Record Store B.V." /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="kvkNumber" render={({ field }) => (<FormItem><FormLabel>KVK Number (or equivalent)</FormLabel><FormControl><Input {...field} placeholder="12345678" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="vatNumber" render={({ field }) => (<FormItem><FormLabel>VAT Number</FormLabel><FormControl><Input {...field} placeholder="NL001234567B01" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField
                      control={form.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <div className="flex items-center">
                            <span className="text-sm text-muted-foreground rounded-l-md border border-r-0 bg-muted px-3 h-10 flex items-center">
                              https://
                            </span>
                            <FormControl>
                               <Input {...field} placeholder="yourstore.com" className="rounded-l-none" />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
            );
        case 1:
            return (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} placeholder="Jan" /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} placeholder="Jansen" /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} placeholder="you@yourstore.com" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                {...field}
                                placeholder="Enter your password"
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type={showConfirmPassword ? "text" : "password"}
                                {...field}
                                placeholder="Confirm your password"
                                className={showMismatch ? "border-destructive focus-visible:ring-destructive" : passwordsMatch ? "border-green-500 focus-visible:ring-green-500" : ""}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              >
                                {showConfirmPassword ? (
                                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          {showMismatch && (
                            <p className="text-sm text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Passwords don&apos;t match
                            </p>
                          )}
                          {passwordsMatch && (
                            <p className="text-sm text-green-600 flex items-center gap-1">
                              <Check className="h-3 w-3" />
                              Passwords match
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
            );
        case 2:
            return (
                <div className="space-y-4 text-center">
                    <h3 className="text-lg font-semibold">Ready to start?</h3>
                    <p className="text-muted-foreground">
                        You&apos;re signing up for the <span className="font-semibold text-primary capitalize">{tier}</span> plan,
                        billed {billing}.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        After registration, you&apos;ll be prompted to connect your Stripe account to receive payments from your customers.
                    </p>
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center gap-3 text-left">
                        <Gift className="h-5 w-5 text-primary shrink-0" />
                        <div>
                            <p className="font-semibold text-sm">7-Day Free Trial Included</p>
                            <p className="text-xs text-muted-foreground">Your first payment will be processed after your trial ends. You can cancel anytime.</p>
                        </div>
                    </div>
                </div>
            );
        default:
            return null;
    }
};

// ---------------------------------------------------------------------------
// Plan summary sidebar
// ---------------------------------------------------------------------------

function PlanSummarySidebar({
    tier,
    tierInfo,
    billing,
    isLoading,
}: {
    tier: string;
    tierInfo: SubscriptionInfo | null;
    billing: string;
    isLoading: boolean;
}) {
    const priceDisplay = (() => {
        if (!tierInfo) return null;
        if (tier === 'payg') return { amount: '€0', suffix: '/month' };
        if (billing === 'quarterly') return { amount: `€${tierInfo.quarterlyPrice ?? 0}`, suffix: '/3 months' };
        if (billing === 'yearly') return { amount: `€${tierInfo.yearlyPrice ?? 0}`, suffix: '/year' };
        return { amount: `€${tierInfo.price ?? 0}`, suffix: '/month' };
    })();

    const recordsLabel = tierInfo
        ? tierInfo.maxRecords === -1
            ? 'Unlimited records'
            : `Up to ${tierInfo.maxRecords.toLocaleString()} records`
        : null;

    const rawFeatures = tierInfo?.features
        ? tierInfo.features.split('\n').map(f => f.trim()).filter(Boolean)
        : [];
    const features = [
        ...(recordsLabel ? [recordsLabel] : []),
        ...rawFeatures.filter(f => !/records?/i.test(f) && !/transaction\s*fee|per\s*sale|%\s*fee/i.test(f)),
    ];

    return (
        <Card className="sticky top-4">
            <CardHeader className="pb-3">
                <CardDescription className="text-xs uppercase tracking-wider">Your plan</CardDescription>
                <CardTitle className="text-xl capitalize">
                    {isLoading ? <Skeleton className="h-6 w-24" /> : tier}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading || !priceDisplay ? (
                    <Skeleton className="h-10 w-28" />
                ) : (
                    <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold tracking-tight">{priceDisplay.amount}</span>
                        <span className="text-sm text-muted-foreground">{priceDisplay.suffix}</span>
                    </div>
                )}

                {tier !== 'payg' && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                        <Gift className="h-3 w-3" />
                        7-day free trial
                    </div>
                )}

                {tierInfo?.transactionFeePercent !== undefined && (
                    <div className="text-xs text-muted-foreground">
                        {tierInfo.transactionFeePercent}% per sale
                    </div>
                )}

                {features.length > 0 && (
                    <ul className="space-y-2 pt-2 border-t">
                        {features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <span className="text-foreground/80">{feature}</span>
                            </li>
                        ))}
                    </ul>
                )}

                <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/pricing">
                        <Pencil className="mr-2 h-3 w-3" />
                        Change plan
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function RegisterPageInner() {
    const { loading: authLoading, isFinalizing, registrationError } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const initialTier = (searchParams.get('tier') as SubscriptionTier) || 'growth';
    const initialBilling = searchParams.get('billing') || 'monthly';
    const stripeSessionId = searchParams.get('stripe_session_id');

    // Fetch live tier data so the sidebar and inactive-gate work correctly
    const [allTiers, setAllTiers] = useState<Record<SubscriptionTier, SubscriptionInfo> | null>(null);
    const [tiersLoading, setTiersLoading] = useState(true);
    const [tierGateRejected, setTierGateRejected] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getSubscriptionTiers()
            .then(data => {
                if (cancelled) return;
                setAllTiers(data);
                setTiersLoading(false);
                // Gate: if the requested tier is deactivated, redirect to /pricing.
                // Skip the gate if we're in the post-Stripe-redirect finalize flow —
                // that user already paid; don't bounce them away from their session.
                if (!stripeSessionId) {
                    const req = data[initialTier];
                    if (!req || req.isActive === false) {
                        setTierGateRejected(true);
                        toast({
                            title: 'Plan unavailable',
                            description: `The '${initialTier}' plan is no longer accepting new customers.`,
                            variant: 'destructive',
                        });
                        router.replace('/pricing');
                    }
                }
            })
            .catch(err => {
                console.error('Failed to load subscription tiers', err);
                if (!cancelled) setTiersLoading(false);
            });
        return () => { cancelled = true; };
    }, [initialTier, router, toast, stripeSessionId]);

    const { activeStep, goToNext, goToPrevious, setActiveStep, isLastStep } = useSteps({
        initialStep: 0,
        steps,
    });

    const form = useForm<OnboardingFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            companyName: "",
            kvkNumber: "",
            vatNumber: "",
            website: "",
            firstName: "",
            lastName: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    // Restore draft from sessionStorage on mount. Only restores if the stored
    // tier/billing matches the current URL params — otherwise the user picked
    // a different plan and we don't want to paint their old company details
    // back into the new flow.
    const [draftRestored, setDraftRestored] = useState(false);
    useEffect(() => {
        if (draftRestored || stripeSessionId) return;
        try {
            const raw = sessionStorage.getItem(DRAFT_STORAGE_KEY);
            if (!raw) {
                setDraftRestored(true);
                return;
            }
            const draft = JSON.parse(raw) as StoredDraft;
            if (draft.tier === initialTier && draft.billing === initialBilling && draft.values) {
                // Passwords are intentionally NOT restored — persisting them in
                // sessionStorage is a soft XSS risk even though sessionStorage is
                // scoped to the tab. Everything else is safe to restore.
                form.reset({
                    ...form.getValues(),
                    ...draft.values,
                    password: '',
                    confirmPassword: '',
                });
                if (typeof draft.activeStep === 'number' && draft.activeStep >= 0 && draft.activeStep < steps.length) {
                    setActiveStep(draft.activeStep);
                }
            }
        } catch (err) {
            console.warn('Failed to restore register draft:', err);
        } finally {
            setDraftRestored(true);
        }
    }, [draftRestored, form, initialTier, initialBilling, setActiveStep, stripeSessionId]);

    // Persist draft on every form change (debounced via rAF) + activeStep changes.
    useEffect(() => {
        if (!draftRestored) return;
        let rafId: number | null = null;
        const save = () => {
            try {
                const values = form.getValues();
                // Strip password fields — never persist secrets, even in sessionStorage.
                const { password, confirmPassword, ...safeValues } = values;
                const draft: StoredDraft = {
                    values: safeValues,
                    activeStep,
                    tier: initialTier,
                    billing: initialBilling,
                };
                sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
            } catch {
                // sessionStorage can throw in private mode; silently ignore.
            }
        };
        const subscription = form.watch(() => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(save);
        });
        // Also save when activeStep changes
        save();
        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            subscription.unsubscribe();
        };
    }, [draftRestored, form, activeStep, initialTier, initialBilling]);

    const triggerValidation = async () => {
        const currentStepFields = steps[activeStep].fields;
        if (!currentStepFields) {
            goToNext();
            return;
        }

        const isValid = await form.trigger(currentStepFields);
        if (isValid) {
            goToNext();
        }
    };

    async function handleSubscription() {
        setIsLoading(true);
        const values = form.getValues();
        const websiteValue = values.website ? (values.website.startsWith('https://') ? values.website : `https://${values.website}`) : undefined;

        const onboardingData = { ...values, website: websiteValue };

        try {
            localStorage.setItem('onboarding_data', JSON.stringify(onboardingData));

            const response = await fetch('/api/stripe/checkout-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tier: initialTier,
                    billing: initialBilling,
                    email: values.email,
                    onboardingData: onboardingData,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create Stripe session.');
            }

            const { url } = await response.json();
            if (url) {
                window.location.href = url;
            } else {
                throw new Error("Stripe checkout URL not found.");
            }

        } catch (error) {
            console.error("Subscription error:", error);
            toast({ title: "Subscription Error", description: (error as Error).message, variant: "destructive" });
            setIsLoading(false);
        }
    }

    if (authLoading || isFinalizing) {
       return (
        <div className="flex min-h-[300px] w-full flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
             <p className="ml-3 text-lg text-muted-foreground">Finalizing your account...</p>
             <p className="text-sm text-muted-foreground">This may take a moment.</p>
        </div>
       );
    }

    if (registrationError) {
        return (
            <Card className="w-full max-w-2xl shadow-2xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-destructive"><AlertTriangle/>Registration Error</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertTitle>There was a problem creating your account.</AlertTitle>
                        <AlertDescription className="mt-2">
                           {registrationError}
                        </AlertDescription>
                    </Alert>
                    <Button onClick={() => window.location.href = '/register'} className="mt-6 w-full">
                        Try Again
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (tierGateRejected) {
        // Brief placeholder while the router.replace to /pricing lands.
        return (
            <div className="flex min-h-[300px] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const tierInfo = allTiers ? allTiers[initialTier] : null;

    return (
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
            <Card className="shadow-2xl">
                <CardHeader>
                    <CardTitle>Start your free trial</CardTitle>
                    <CardDescription>Join Vinylogix today and revolutionize your record store.</CardDescription>
                    <p className="text-sm text-muted-foreground pt-1">
                      Looking to browse and collect?{' '}
                      <Link href="/get-started?role=collector" className="font-medium text-primary hover:underline">Create a free collector account instead</Link>
                    </p>
                </CardHeader>
                <CardContent>
                    <Stepper activeStep={activeStep}>
                        {steps.map((step, index) => (
                            <Step key={step.label} index={index}>
                                <StepIndicator>
                                    <StepStatus
                                        complete={<StepIcon as={Check} />}
                                        incomplete={<StepNumber />}
                                        active={<StepNumber />}
                                    />
                                </StepIndicator>
                            </Step>
                        ))}
                    </Stepper>

                    <div className="my-8">
                      <Form {...form}>
                          <form>
                             <StepContent
                               activeStep={activeStep}
                               form={form}
                               tier={initialTier}
                               billing={initialBilling}
                             />
                              <div className="flex justify-between mt-8">
                                    <Button type="button" variant="outline" onClick={goToPrevious} disabled={activeStep === 0}>
                                        Back
                                    </Button>
                                    {!isLastStep ? (
                                        <Button type="button" onClick={triggerValidation}>
                                            Next <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    ) : (
                                        <Button type="button" disabled={isLoading} onClick={handleSubscription}>
                                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Proceed to Payment
                                        </Button>
                                    )}
                                </div>
                          </form>
                      </Form>
                    </div>
                </CardContent>
            </Card>

            <div className="md:block">
                <PlanSummarySidebar
                    tier={initialTier}
                    tierInfo={tierInfo}
                    billing={initialBilling}
                    isLoading={tiersLoading}
                />
            </div>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-[300px] w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <RegisterPageInner />
        </Suspense>
    );
}


"use client";

import { useAuth } from '@/hooks/use-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, UseFormReturn } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper, Step, StepIndicator, StepStatus, StepNumber, StepTitle, StepDescription, StepSeparator, useSteps, StepIcon } from "@/components/ui/stepper";
import { Check, Loader2, Building, User, Key, ArrowRight, AlertTriangle } from "lucide-react";
import React, { useState, useEffect } from "react";
import type { SubscriptionTier } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Step 1: Company Information
const companySchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  kvkNumber: z.string().optional(), // KVK or equivalent chamber of commerce number
  vatNumber: z.string().optional(),
  website: z.string().url("Please enter a valid URL (e.g., https://example.com)").optional().or(z.literal("")),
});

// Step 2: Personal Details with new fields
const personSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});


// Combined Schema for validation before payment step
const formSchema = companySchema.merge(personSchema);
export type OnboardingFormValues = z.infer<typeof formSchema>;

const steps = [
  { label: "Company", icon: Building },
  { label: "Your Details", icon: User },
  { label: "Subscribe", icon: Key },
];

// Moved StepContent outside the main component to prevent re-rendering issues.
const StepContent = ({ activeStep, form, initialTier, initialBilling, isLoading }: { 
    activeStep: number; 
    form: UseFormReturn<OnboardingFormValues>;
    initialTier: SubscriptionTier;
    initialBilling: string;
    isLoading: boolean;
}) => {
    switch (activeStep) {
        case 0:
            return (
                <div className="space-y-4">
                    <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} placeholder="Your Record Store B.V." /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="kvkNumber" render={({ field }) => (<FormItem><FormLabel>KVK Number (or equivalent)</FormLabel><FormControl><Input {...field} placeholder="12345678" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="vatNumber" render={({ field }) => (<FormItem><FormLabel>VAT Number</FormLabel><FormControl><Input {...field} placeholder="NL001234567B01" /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="website" render={({ field }) => (<FormItem><FormLabel>Website</FormLabel><FormControl><Input {...field} placeholder="https://yourstore.com" /></FormControl><FormMessage /></FormItem>)} />
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
                    <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="confirmPassword" render={({ field }) => (<FormItem><FormLabel>Confirm Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
            );
        case 2:
            return (
                <div className="space-y-4 text-center">
                    <h3 className="text-lg font-semibold">Ready to Start?</h3>
                    <p className="text-muted-foreground">You're signing up for the <span className="font-semibold text-primary capitalize">{initialTier}</span> plan, billed {initialBilling}.</p>
                    <p className="text-sm text-muted-foreground">After registration, you'll be prompted to connect your Stripe account to receive payments from your customers.</p>
                    <div className="p-4 bg-muted/50 rounded-lg">
                       <p className="font-bold">7-Day Free Trial Included!</p>
                       <p className="text-xs">Your first payment will be processed after your trial ends. You can cancel anytime.</p>
                    </div>
                </div>
            );
        default:
            return null;
    }
};

export default function RegisterPage() {
    const { loading: authLoading, isFinalizing, registrationError } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const searchParams = useSearchParams();
    const { toast } = useToast();
    
    const initialTier = searchParams.get('tier') as SubscriptionTier || 'growth';
    const initialBilling = searchParams.get('billing') || 'monthly';
    
    const { activeStep, goToNext, goToPrevious, isDisabledStep, isLastStep, isOptionalStep } = useSteps({
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

    const triggerValidation = async () => {
        let fieldsToValidate: (keyof OnboardingFormValues)[] = [];
        if (activeStep === 0) fieldsToValidate = ["companyName", "kvkNumber", "vatNumber", "website"];
        if (activeStep === 1) fieldsToValidate = ["firstName", "lastName", "email", "password", "confirmPassword"];
        
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            goToNext();
        }
    };
    
    async function handleSubscription() {
        setIsLoading(true);
        const values = form.getValues();
        try {
            // Before redirecting, we store form data in localStorage
            // so we can retrieve it after the redirect from Stripe.
            localStorage.setItem('onboarding_data', JSON.stringify(values));

            const response = await fetch('/api/stripe/checkout-session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    tier: initialTier, 
                    billing: initialBilling,
                    email: values.email, // Pass email for pre-filling
                    onboardingData: values, // Pass all data for metadata
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to create Stripe session.');
            }

            const { url } = await response.json();
            if (url) {
                window.location.href = url; // Redirect to Stripe
            } else {
                throw new Error("Stripe checkout URL not found.");
            }

        } catch (error) {
            console.error("Subscription error:", error);
            toast({ title: "Subscription Error", description: (error as Error).message, variant: "destructive" });
        } finally {
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

    return (
        <Card className="w-full max-w-2xl shadow-2xl">
            <CardHeader>
                <CardTitle>Start Your Free Trial</CardTitle>
                <CardDescription>Join Vinylogix today and revolutionize your record store.</CardDescription>
            </CardHeader>
            <CardContent>
                <Stepper activeStep={activeStep}>
                    {steps.map((step, index) => (
                        <Step key={step.label} index={index} label={step.label}>
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
                           initialTier={initialTier} 
                           initialBilling={initialBilling} 
                           isLoading={isLoading} 
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
    );
}

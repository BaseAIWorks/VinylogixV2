
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
import { Check, Loader2, Building, User, Key, ArrowRight, AlertTriangle, Eye, EyeOff } from "lucide-react";
import React, { useState, useEffect } from "react";
import type { SubscriptionTier } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

const StepContent = ({ activeStep, form }: {
    activeStep: number;
    form: UseFormReturn<OnboardingFormValues>;
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
                              Passwords don't match
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
           const { getValues } = form;
           const values = getValues();
           const tier = useSearchParams().get('tier') || 'growth';
           const billing = useSearchParams().get('billing') || 'monthly';
            return (
                <div className="space-y-4 text-center">
                    <h3 className="text-lg font-semibold">Ready to Start?</h3>
                    <p className="text-muted-foreground">You're signing up for the <span className="font-semibold text-primary capitalize">{tier}</span> plan, billed {billing}.</p>
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
    
    const { activeStep, goToNext, goToPrevious, isLastStep } = useSteps({
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

"use client";

import { useState, useEffect, Suspense } from 'react';
import RegisterForm from '@/components/auth/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Heart, Store, ArrowLeft, Gift, Sparkles } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

type Choice = 'none' | 'collector';

function GetStartedInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRole = searchParams.get('role');

  // If ?role=collector is set, skip the picker and land directly in the form.
  // This gives entry points that already know the visitor's intent (e.g. the
  // "Create a free client account" link on /pricing) a one-click path.
  const [choice, setChoice] = useState<Choice>(
    preselectedRole === 'collector' ? 'collector' : 'none',
  );

  // Keep URL in sync if the user navigates backwards in the stepper. Removes
  // stale ?role params so a back-nav doesn't loop them into the picker state.
  useEffect(() => {
    if (choice === 'none' && preselectedRole) {
      const url = new URL(window.location.href);
      url.searchParams.delete('role');
      window.history.replaceState({}, '', url.toString());
    }
  }, [choice, preselectedRole]);

  if (choice === 'collector') {
    return (
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="space-y-2">
          {!preselectedRole && (
            <Button
              variant="ghost"
              size="sm"
              className="w-fit -ml-2"
              onClick={() => setChoice('none')}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          )}
          <CardTitle className="text-2xl text-center">Create Your Collector Account</CardTitle>
          <CardDescription className="text-center">
            Browse catalogs, place orders, and manage your personal vinyl collection. Free forever.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>Good to know</AlertTitle>
            <AlertDescription>
              To see prices and place orders, you can request access from any distributor&apos;s storefront after signing up.
            </AlertDescription>
          </Alert>
          <RegisterForm />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Button variant="link" asChild className="p-0 font-medium text-accent hover:underline">
              <Link href="/login">Log in</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-3xl shadow-2xl">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-2xl">Welcome to Vinylogix</CardTitle>
        <CardDescription>How will you use Vinylogix?</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Collector */}
          <button
            onClick={() => setChoice('collector')}
            className="group flex flex-col items-center gap-4 rounded-xl border-2 border-muted p-6 text-center transition-all hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">I collect records</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse catalogs, place orders, and manage your personal collection.
              </p>
            </div>
            <div className="mt-auto space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full">
                <Sparkles className="h-3 w-3" />
                Free forever
              </div>
              <p className="text-sm font-medium text-primary">
                Create free account &rarr;
              </p>
            </div>
          </button>

          {/* Distributor */}
          <button
            onClick={() => router.push('/pricing')}
            className="group flex flex-col items-center gap-4 rounded-xl border-2 border-muted p-6 text-center transition-all hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">I sell records</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Run your store, process orders, grow your business.
              </p>
            </div>
            <div className="mt-auto space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                <Gift className="h-3 w-3" />
                7-day free trial
              </div>
              <p className="text-sm font-medium text-primary">
                Choose a plan &rarr;
              </p>
            </div>
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Button variant="link" asChild className="p-0 font-medium text-accent hover:underline">
            <Link href="/login">Log in</Link>
          </Button>
        </p>
      </CardContent>
    </Card>
  );
}

export default function GetStartedPage() {
  return (
    <Suspense fallback={null}>
      <GetStartedInner />
    </Suspense>
  );
}

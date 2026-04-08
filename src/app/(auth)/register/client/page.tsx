
"use client";

import { useState } from 'react';
import RegisterForm from '@/components/auth/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Heart, Store, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [choice, setChoice] = useState<'none' | 'client'>('none');

  if (choice === 'client') {
    return (
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2"
            onClick={() => setChoice('none')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <CardTitle className="text-2xl text-center">Create Your Account</CardTitle>
          <CardDescription className="text-center">
            Sign up to browse catalogs, place orders, and manage your vinyl collection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>Good to know</AlertTitle>
            <AlertDescription>
              To see prices and place orders, you can request access from any distributor's storefront after signing up.
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
    <Card className="w-full max-w-2xl shadow-2xl">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-2xl">Join Vinylogix</CardTitle>
        <CardDescription>How would you like to use Vinylogix?</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Client / Collector */}
          <button
            onClick={() => setChoice('client')}
            className="group flex flex-col items-center gap-4 rounded-xl border-2 border-muted p-6 text-center transition-all hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Heart className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Client / Collector</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Browse vinyl catalogs, place orders, and manage your personal record collection.
              </p>
            </div>
            <span className="mt-auto text-sm font-medium text-primary">
              Create Free Account &rarr;
            </span>
          </button>

          {/* Distributor / Shop */}
          <button
            onClick={() => router.push('/pricing')}
            className="group flex flex-col items-center gap-4 rounded-xl border-2 border-muted p-6 text-center transition-all hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Distributor / Shop</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage your vinyl inventory, sell to clients, process orders, and grow your business.
              </p>
            </div>
            <span className="mt-auto text-sm font-medium text-primary">
              Start Your Store &rarr;
            </span>
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

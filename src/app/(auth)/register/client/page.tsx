
"use client";

import RegisterForm from '@/components/auth/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Building } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  
  return (
      <Card className="w-full max-w-lg shadow-2xl">
        <Tabs defaultValue="client" className="w-full">
          <CardHeader>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="client">Client</TabsTrigger>
              <TabsTrigger value="distributor">Distributor / Shop</TabsTrigger>
            </TabsList>
          </CardHeader>
          <TabsContent value="client">
            <CardHeader className="text-center space-y-2 pt-0">
              <CardTitle className="text-2xl">Create a Client Account</CardTitle>
              <CardDescription>Sign up to start your collection and get access to distributor catalogs.</CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-6">
                <Info className="h-4 w-4" />
                <AlertTitle>Please Note</AlertTitle>
                <AlertDescription>
                  To view a store's catalog, prices, and to place orders, you must be invited by that distributor after creating your account.
                </AlertDescription>
              </Alert>
              <RegisterForm />
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                 <Button variant="link" asChild className="p-0 font-medium text-accent hover:underline">
                  <Link href="/login">
                    Log in
                  </Link>
                </Button>
              </p>
            </CardContent>
          </TabsContent>
          <TabsContent value="distributor">
              <CardHeader className="text-center space-y-2 pt-0">
                <CardTitle className="text-2xl">Start Your Business on Vinylogix</CardTitle>
                <CardDescription>Join our platform to manage your inventory, orders, and clients with our powerful tools.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center text-center p-8">
                  <Building className="h-16 w-16 text-primary mb-4"/>
                  <p className="mb-4 text-muted-foreground">
                    Our multi-step onboarding will guide you through setting up your subscription and business profile.
                  </p>
                  <Button size="lg" onClick={() => router.push('/pricing')}>
                    Start Distributor Onboarding
                  </Button>
              </CardContent>
          </TabsContent>
        </Tabs>
      </Card>
  );
}

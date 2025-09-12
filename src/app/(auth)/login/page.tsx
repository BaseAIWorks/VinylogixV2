
"use client";

import LoginForm from '@/components/auth/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoginPage() {
  
  return (
      <Card className="w-full max-w-md shadow-2xl">
        <Tabs defaultValue="client" className="w-full">
            <CardHeader>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="client">Client</TabsTrigger>
                    <TabsTrigger value="distributor">Distributor / Operator</TabsTrigger>
                </TabsList>
            </CardHeader>
             <TabsContent value="client">
                <CardHeader className="text-center space-y-2 pt-0">
                  <CardTitle className="text-2xl">Client Login</CardTitle>
                  <CardDescription>Log in to access your collection and orders.</CardDescription>
                </CardHeader>
                <CardContent>
                  <LoginForm />
                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    Don't have an account?{' '}
                     <Button variant="link" asChild className="p-0 font-medium text-accent hover:underline">
                      <Link href="/register/client">
                        Sign up
                      </Link>
                    </Button>
                  </p>
                </CardContent>
             </TabsContent>
              <TabsContent value="distributor">
                <CardHeader className="text-center space-y-2 pt-0">
                  <CardTitle className="text-2xl">Distributor / Operator Login</CardTitle>
                  <CardDescription>Log in to manage your store.</CardDescription>
                </CardHeader>
                <CardContent>
                  <LoginForm />
                </CardContent>
             </TabsContent>
        </Tabs>
      </Card>
  );
}

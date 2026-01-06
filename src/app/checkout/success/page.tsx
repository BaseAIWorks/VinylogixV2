"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    // Clear the cart after successful payment
    clearCart();

    // The webhook will handle creating the order
    // Here we just confirm the payment was successful
    const timer = setTimeout(() => {
      setStatus('success');
    }, 2000);

    return () => clearTimeout(timer);
  }, [sessionId, clearCart]);

  if (status === 'loading') {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <Card>
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Processing your payment...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your order.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <Card>
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Payment Error</h2>
            <p className="text-muted-foreground mb-6">
              There was an error processing your payment. Please try again.
            </p>
            <Button asChild>
              <Link href="/checkout">Return to Checkout</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-20">
      <Card>
        <CardHeader className="text-center">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-3xl">Payment Successful!</CardTitle>
          <CardDescription className="text-base">
            Thank you for your order. You will receive a confirmation email shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Session ID</p>
            <p className="font-mono text-sm break-all">{sessionId}</p>
          </div>
          <div className="flex gap-4 justify-center pt-4">
            <Button asChild>
              <Link href="/my-orders">View My Orders</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Continue Shopping</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

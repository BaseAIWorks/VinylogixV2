"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, XCircle, ShoppingBag, Home } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export default function PayPalSuccessPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { clearCart } = useAuth();

    const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
    const [orderNumber, setOrderNumber] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const orderId = searchParams.get('orderId');
    const paypalOrderId = searchParams.get('token'); // PayPal returns the order ID as 'token'

    useEffect(() => {
        async function capturePayment() {
            if (!orderId || !paypalOrderId) {
                setStatus('error');
                setErrorMessage('Missing order information. Please contact support.');
                return;
            }

            try {
                const response = await fetch('/api/paypal/connect/capture', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        pendingOrderId: orderId,
                        paypalOrderId: paypalOrderId,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to capture payment');
                }

                setStatus('success');
                setOrderNumber(data.orderNumber);

                // Clear the cart after successful order
                clearCart();
            } catch (error) {
                console.error('Payment capture error:', error);
                setStatus('error');
                setErrorMessage((error as Error).message);
            }
        }

        capturePayment();
    }, [orderId, paypalOrderId, clearCart]);

    return (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
            <Card className="max-w-md w-full">
                {status === 'processing' && (
                    <>
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4">
                                <Loader2 className="h-16 w-16 text-primary animate-spin" />
                            </div>
                            <CardTitle>Processing Payment</CardTitle>
                            <CardDescription>
                                Please wait while we confirm your PayPal payment...
                            </CardDescription>
                        </CardHeader>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4">
                                <CheckCircle className="h-16 w-16 text-green-500" />
                            </div>
                            <CardTitle className="text-green-600">Payment Successful!</CardTitle>
                            <CardDescription>
                                Thank you for your order. Your payment has been processed successfully.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {orderNumber && (
                                <div className="text-center p-4 bg-muted rounded-lg">
                                    <p className="text-sm text-muted-foreground">Order Number</p>
                                    <p className="text-lg font-bold">{orderNumber}</p>
                                </div>
                            )}
                            <p className="text-sm text-center text-muted-foreground">
                                A confirmation email has been sent to your email address.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button asChild className="flex-1">
                                    <Link href="/my-orders">
                                        <ShoppingBag className="mr-2 h-4 w-4" />
                                        View Orders
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" className="flex-1">
                                    <Link href="/inventory">
                                        <Home className="mr-2 h-4 w-4" />
                                        Continue Shopping
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4">
                                <XCircle className="h-16 w-16 text-destructive" />
                            </div>
                            <CardTitle className="text-destructive">Payment Failed</CardTitle>
                            <CardDescription>
                                {errorMessage || 'There was an error processing your payment.'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-center text-muted-foreground">
                                Please try again or contact support if the problem persists.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button asChild className="flex-1">
                                    <Link href="/checkout">
                                        Try Again
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" className="flex-1">
                                    <Link href="/cart">
                                        Back to Cart
                                    </Link>
                                </Button>
                            </div>
                        </CardContent>
                    </>
                )}
            </Card>
        </div>
    );
}

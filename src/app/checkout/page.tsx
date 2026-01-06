
"use client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatPriceForDisplay } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, FileText, ShoppingBag, CreditCard, Loader2, Check, ArrowLeft, AlertCircle } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { User, Distributor } from "@/types";
import { getDistributorById } from "@/services/distributor-service";

const formatAddress = (user: Partial<User>, type: 'shipping' | 'billing' = 'shipping'): string => {
    if (type === 'billing' && user.useDifferentBillingAddress) {
        return user.billingAddress || "No billing address set.";
    }

    const addressParts = [
        user.addressLine1,
        user.addressLine2,
        `${user.postcode || ''} ${user.city || ''}`.trim(),
        user.country
    ];
    const formatted = addressParts.filter(Boolean).join('\n');
    return formatted || "No shipping address set.";
};

const AddressCard = ({ title, icon: Icon, user, type }: { title: string, icon: React.ElementType, user: User, type: 'shipping' | 'billing'}) => (
    <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
                <Icon className="h-5 w-5 text-primary"/>
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</p>
            <p className="whitespace-pre-wrap">{formatAddress(user, type)}</p>
             {formatAddress(user, type).startsWith("No") && <Link href="/settings" className="underline text-primary">Add address</Link>}
        </CardContent>
    </Card>
);

type PaymentMethod = 'stripe' | 'paypal';

export default function CheckoutPage() {
    const { user, cart, cartTotal, clearCart } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
    const [distributor, setDistributor] = useState<Distributor | null>(null);
    const [isLoadingDistributor, setIsLoadingDistributor] = useState(true);

    // Get the distributor ID from the first cart item
    const distributorId = cart.length > 0 ? cart[0].distributorId : null;

    // Load distributor to check available payment methods
    useEffect(() => {
        async function loadDistributor() {
            if (!distributorId) {
                setIsLoadingDistributor(false);
                return;
            }
            try {
                const dist = await getDistributorById(distributorId);
                setDistributor(dist);

                // Set default payment method based on availability
                if (dist?.stripeAccountId && dist.stripeAccountStatus === 'verified') {
                    setPaymentMethod('stripe');
                } else if (dist?.paypalMerchantId && dist.paypalAccountStatus === 'verified') {
                    setPaymentMethod('paypal');
                }
            } catch (error) {
                console.error('Failed to load distributor:', error);
            } finally {
                setIsLoadingDistributor(false);
            }
        }
        loadDistributor();
    }, [distributorId]);

    if (!user) {
        return <div/>;
    }

    const isAddressSet = user.addressLine1 && user.city && user.postcode && user.country;

    // Get list of missing address fields for user feedback
    const getMissingAddressFields = () => {
        const missing: string[] = [];
        if (!user.addressLine1) missing.push('Street address');
        if (!user.city) missing.push('City');
        if (!user.postcode) missing.push('Postal code');
        if (!user.country) missing.push('Country');
        return missing;
    };
    const missingFields = getMissingAddressFields();

    // Check available payment methods
    const stripeAvailable = distributor?.stripeAccountId && distributor.stripeAccountStatus === 'verified';
    const paypalAvailable = distributor?.paypalMerchantId && distributor.paypalAccountStatus === 'verified';
    const anyPaymentMethodAvailable = stripeAvailable || paypalAvailable;

    const handlePlaceOrder = async () => {
        if (!isAddressSet) {
            toast({
                title: "Missing Address",
                description: "Please add a complete shipping address in your settings before placing an order.",
                variant: "destructive"
            });
            router.push('/settings');
            return;
        }

        if (cart.length === 0) {
            toast({
                title: "Empty Cart",
                description: "Your cart is empty. Please add items before checking out.",
                variant: "destructive"
            });
            return;
        }

        if (!anyPaymentMethodAvailable) {
            toast({
                title: "Payment Not Available",
                description: "This distributor has not set up any payment methods yet.",
                variant: "destructive"
            });
            return;
        }

        setIsPlacingOrder(true);
        try {
            if (paymentMethod === 'stripe') {
                await handleStripeCheckout();
            } else {
                await handlePayPalCheckout();
            }
        } catch (error) {
            console.error("Failed to initiate checkout:", error);
            toast({
                title: "Checkout Failed",
                description: (error as Error).message || "There was an error initiating checkout. Please try again.",
                variant: "destructive"
            });
            setIsPlacingOrder(false);
        }
    };

    const handleStripeCheckout = async () => {
        const shippingAddress = formatAddress(user, 'shipping');
        const billingAddress = formatAddress(user, 'billing');
        const customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';

        const response = await fetch('/api/stripe/connect/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                distributorId,
                items: cart,
                customerEmail: user.email,
                userId: user.uid,
                customerName,
                shippingAddress,
                billingAddress,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create checkout session');
        }

        if (data.url) {
            window.location.href = data.url;
        } else {
            throw new Error('No checkout URL received');
        }
    };

    const handlePayPalCheckout = async () => {
        const shippingAddress = formatAddress(user, 'shipping');
        const billingAddress = formatAddress(user, 'billing');
        const customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';

        const response = await fetch('/api/paypal/connect/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                distributorId,
                items: cart,
                customerEmail: user.email,
                viewerId: user.uid,
                shippingAddress,
                billingAddress,
                customerName,
                phoneNumber: user.phoneNumber || user.mobileNumber,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to create PayPal order');
        }

        if (data.approvalUrl) {
            window.location.href = data.approvalUrl;
        } else {
            throw new Error('No PayPal checkout URL received');
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()} title="Go back">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                        <AddressCard title="Shipping Address" icon={Home} user={user} type="shipping"/>
                        <AddressCard title="Billing Address" icon={FileText} user={user} type="billing"/>
                    </div>
                     <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-5 w-5 text-primary"/>Payment Method</CardTitle></CardHeader>
                        <CardContent>
                            {isLoadingDistributor ? (
                                <div className="flex items-center justify-center p-6">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : !anyPaymentMethodAvailable ? (
                                <div className="p-6 border-2 border-dashed border-destructive/50 rounded-lg text-center">
                                    <p className="font-medium text-destructive mb-2">No Payment Methods Available</p>
                                    <p className="text-sm text-muted-foreground">This seller has not set up payment processing yet.</p>
                                </div>
                            ) : (
                                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="space-y-3">
                                    {stripeAvailable && (
                                        <div className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'stripe' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                             onClick={() => setPaymentMethod('stripe')}>
                                            <RadioGroupItem value="stripe" id="stripe" />
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="h-10 w-10 bg-[#635BFF] rounded flex items-center justify-center flex-shrink-0">
                                                    <span className="text-white font-bold">S</span>
                                                </div>
                                                <div>
                                                    <Label htmlFor="stripe" className="font-medium cursor-pointer">Credit / Debit Card</Label>
                                                    <p className="text-sm text-muted-foreground">Pay securely with Stripe</p>
                                                </div>
                                            </div>
                                            {paymentMethod === 'stripe' && <Check className="h-5 w-5 text-primary" />}
                                        </div>
                                    )}
                                    {paypalAvailable && (
                                        <div className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'paypal' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                             onClick={() => setPaymentMethod('paypal')}>
                                            <RadioGroupItem value="paypal" id="paypal" />
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="h-10 w-10 bg-[#003087] rounded flex items-center justify-center flex-shrink-0">
                                                    <span className="text-white font-bold">P</span>
                                                </div>
                                                <div>
                                                    <Label htmlFor="paypal" className="font-medium cursor-pointer">PayPal</Label>
                                                    <p className="text-sm text-muted-foreground">Pay with your PayPal account</p>
                                                </div>
                                            </div>
                                            {paymentMethod === 'paypal' && <Check className="h-5 w-5 text-primary" />}
                                        </div>
                                    )}
                                </RadioGroup>
                            )}
                        </CardContent>
                    </Card>
                </div>
                <div className="md:col-span-1">
                    <Card className="sticky top-20">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-primary"/>Order Summary</CardTitle>
                            <CardDescription>{cart.length} item(s)</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 max-h-64 overflow-y-auto">
                            {cart.map(item => (
                                <div key={item.record.id} className="flex items-center gap-4">
                                    <Image src={item.record.cover_url || 'https://placehold.co/64x64.png'} alt={item.record.title} width={64} height={64} className="rounded-md aspect-square object-cover" />
                                    <div className="flex-grow">
                                        <p className="font-medium leading-tight">{item.record.title}</p>
                                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                                    </div>
                                    <p className="font-medium">€ {formatPriceForDisplay((item.record.sellingPrice || 0) * item.quantity)}</p>
                                </div>
                            ))}
                        </CardContent>
                        <CardFooter className="flex-col items-stretch space-y-4 pt-4 border-t">
                           <div className="flex justify-between font-semibold text-lg">
                                <span>Total</span>
                                <span>€ {formatPriceForDisplay(cartTotal)}</span>
                           </div>
                            {/* Warning for missing address fields */}
                            {missingFields.length > 0 && (
                                <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-medium text-orange-800 dark:text-orange-300">Missing shipping information</p>
                                        <p className="text-orange-700 dark:text-orange-400 mt-1">
                                            Please add: {missingFields.join(', ')}
                                        </p>
                                        <Link href="/settings" className="inline-block mt-2 text-orange-700 dark:text-orange-300 underline hover:no-underline font-medium">
                                            Go to Settings
                                        </Link>
                                    </div>
                                </div>
                            )}
                            {/* Warning for empty cart */}
                            {cart.length === 0 && (
                                <div className="flex items-start gap-2 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                                    <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm">
                                        <p className="font-medium text-orange-800 dark:text-orange-300">Your cart is empty</p>
                                        <p className="text-orange-700 dark:text-orange-400 mt-1">
                                            Add items to your cart before checking out.
                                        </p>
                                    </div>
                                </div>
                            )}
                            <Button size="lg" className="w-full" onClick={handlePlaceOrder} disabled={isPlacingOrder || cart.length === 0 || !isAddressSet}>
                                {isPlacingOrder && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Place Order
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </div>
    )
}


"use client";
import { useAuth } from "@/hooks/use-auth";
import { auth } from "@/lib/firebase";
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
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import type { User, Distributor } from "@/types";
import { getDistributorById } from "@/services/distributor-service";
import { calculateShipping, findShippingZone } from "@/lib/shipping-utils";
import { logActivity } from "@/services/activity-service";
import { Truck, Package } from "lucide-react";

const formatAddress = (user: Partial<User>, type: 'shipping' | 'billing' = 'shipping'): string => {
    if (type === 'billing' && user.useDifferentBillingAddress) {
        // Use structured billing address fields if available, else fall back to legacy
        const billingParts = [
            user.billingAddressLine1,
            user.billingAddressLine2,
            `${user.billingPostcode || ''} ${user.billingCity || ''}`.trim(),
            user.billingCountry
        ];
        const formatted = billingParts.filter(Boolean).join('\n');
        return formatted || user.billingAddress || "No billing address set.";
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

type PaymentMethod = 'stripe' | 'paypal' | 'request';

export default function CheckoutPage() {
    const { user, cart, cartTotal, clearCart } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('stripe');
    const [distributor, setDistributor] = useState<Distributor | null>(null);
    const [isLoadingDistributor, setIsLoadingDistributor] = useState(true);
    const [shippingMethod, setShippingMethod] = useState<'shipping' | 'pickup'>('shipping');

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

                // Set default payment method based on availability. When the
                // distributor has stripeCheckoutDisabled on (typically Scale
                // tier / managed accounts that want to avoid Stripe fees on
                // high-value wholesale orders), the only option is Request
                // Order — the Stripe and PayPal radios are hidden below.
                if (dist?.stripeCheckoutDisabled === true) {
                    setPaymentMethod('request');
                } else if (dist?.stripeAccountId && dist.stripeAccountStatus === 'verified') {
                    setPaymentMethod('stripe');
                } else if (dist?.paypalMerchantId && dist.paypalAccountStatus === 'verified') {
                    setPaymentMethod('paypal');
                } else {
                    setPaymentMethod('request');
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

    // Shipping calculation
    const totalWeight = useMemo(() => cart.reduce((sum, item) => sum + (item.record.weight || 0) * item.quantity, 0), [cart]);
    const shippingResult = useMemo(() => {
        if (!distributor?.shippingConfig?.enabled) return null;
        return calculateShipping(distributor.shippingConfig, user.country, totalWeight, cartTotal, shippingMethod);
    }, [distributor?.shippingConfig, user.country, totalWeight, cartTotal, shippingMethod]);
    const shippingCost = shippingResult?.shippingCost || 0;
    const orderTotal = cartTotal + shippingCost;
    const hasShippingZone = distributor?.shippingConfig?.enabled ? !!findShippingZone(distributor.shippingConfig, user.country) : true;

    // Check available payment methods
    // Distributors can opt out of Stripe entirely (stripeCheckoutDisabled).
    // When on, only Request Order is offered regardless of Stripe-account
    // verification status. Applies to PayPal too for consistency — if online
    // checkout is disabled it's disabled across the board.
    const onlineCheckoutDisabled = distributor?.stripeCheckoutDisabled === true;
    const stripeAvailable = !onlineCheckoutDisabled
        && distributor?.stripeAccountId && distributor.stripeAccountStatus === 'verified';
    const paypalAvailable = !onlineCheckoutDisabled
        && distributor?.paypalMerchantId && distributor.paypalAccountStatus === 'verified';
    const requestOrderAvailable = distributor?.allowOrderRequests === true || onlineCheckoutDisabled;
    const anyPaymentMethodAvailable = stripeAvailable || paypalAvailable || requestOrderAvailable;

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
            if (paymentMethod === 'request') {
                await handleRequestOrder();
            } else if (paymentMethod === 'stripe') {
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
        const token = await auth.currentUser?.getIdToken();

        const response = await fetch('/api/stripe/connect/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                distributorId,
                items: cart,
                customerEmail: user.email,
                customerName,
                shippingAddress,
                billingAddress,
                customerCountry: user.country,
                shippingMethod,
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
        const token = await auth.currentUser?.getIdToken();

        const response = await fetch('/api/paypal/connect/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                distributorId,
                items: cart,
                customerEmail: user.email,
                shippingAddress,
                billingAddress,
                customerName,
                phoneNumber: user.phoneNumber || user.mobileNumber,
                customerCountry: user.country,
                shippingMethod,
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

    const handleRequestOrder = async () => {
        if (!user || !distributorId) throw new Error('Missing user or distributor');
        const shippingAddress = formatAddress(user, 'shipping');
        const billingAddress = formatAddress(user, 'billing');
        const customerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || '';

        const { createOrderRequestServer } = await import('@/services/server-order-service');
        const order = await createOrderRequestServer({
            viewerId: user.uid,
            distributorId,
            items: cart.map(item => ({
                recordId: item.record.id,
                title: item.record.title,
                artist: item.record.artist,
                cover_url: item.record.cover_url,
                sellingPrice: item.record.sellingPrice || 0,
                quantity: item.quantity,
                weight: item.record.weight,
            })),
            customerName,
            customerEmail: user.email || '',
            shippingAddress,
            billingAddress: user.useDifferentBillingAddress ? billingAddress : undefined,
            phoneNumber: user.phoneNumber,
            customerCompanyName: user.companyName,
            customerVatNumber: user.vatNumber,
            customerVatValidated: user.vatValidated === true,
            customerEoriNumber: user.eoriNumber,
            customerChamberOfCommerce: user.chamberOfCommerce,
            customerCountry: user.country,
            shippingMethod,
        });
        // Log order activity
        logActivity({
            userId: user.uid,
            userEmail: user.email || '',
            userRole: user.role,
            sessionId: `checkout_${Date.now()}`,
            action: 'order_placed',
            details: `Placed order ${order.orderNumber || order.id} (€${formatPriceForDisplay(orderTotal)})`,
            metadata: { orderId: order.id, distributorId },
        });
        clearCart();
        router.push(`/my-orders/${order.id}?requested=true`);
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
                                                    <Label htmlFor="stripe" className="font-medium cursor-pointer">iDEAL, Card & more</Label>
                                                    <p className="text-sm text-muted-foreground">Pay securely via Stripe</p>
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
                                    {requestOrderAvailable && (
                                        <div className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${paymentMethod === 'request' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                                             onClick={() => setPaymentMethod('request')}>
                                            <RadioGroupItem value="request" id="request" />
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className="h-10 w-10 bg-amber-500 rounded flex items-center justify-center flex-shrink-0">
                                                    <span className="text-white font-bold">R</span>
                                                </div>
                                                <div>
                                                    <Label htmlFor="request" className="font-medium cursor-pointer">Request Order</Label>
                                                    <p className="text-sm text-muted-foreground">Place order for approval, pay later</p>
                                                </div>
                                            </div>
                                            {paymentMethod === 'request' && <Check className="h-5 w-5 text-primary" />}
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
                           {/* Shipping method selector */}
                           {distributor?.shippingConfig?.enabled && (
                             <div className="space-y-2">
                               {distributor.shippingConfig.allowPickup && (
                                 <RadioGroup value={shippingMethod} onValueChange={(v) => setShippingMethod(v as 'shipping' | 'pickup')} className="flex gap-3">
                                   <div className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer flex-1 ${shippingMethod === 'shipping' ? 'border-primary bg-primary/5' : 'border-border'}`} onClick={() => setShippingMethod('shipping')}>
                                     <RadioGroupItem value="shipping" id="ship" />
                                     <Label htmlFor="ship" className="cursor-pointer flex items-center gap-1.5 text-xs"><Truck className="h-3.5 w-3.5" />Shipping</Label>
                                   </div>
                                   <div className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer flex-1 ${shippingMethod === 'pickup' ? 'border-primary bg-primary/5' : 'border-border'}`} onClick={() => setShippingMethod('pickup')}>
                                     <RadioGroupItem value="pickup" id="pick" />
                                     <Label htmlFor="pick" className="cursor-pointer flex items-center gap-1.5 text-xs"><Package className="h-3.5 w-3.5" />Pickup</Label>
                                   </div>
                                 </RadioGroup>
                               )}
                               {shippingMethod === 'shipping' && !hasShippingZone && user.country && (
                                 <p className="text-xs text-orange-600">Shipping to {user.country} is not available. Contact the distributor.</p>
                               )}
                               {shippingMethod === 'shipping' && !user.country && (
                                 <p className="text-xs text-orange-600">Set your country in <Link href="/settings" className="underline">settings</Link> to calculate shipping.</p>
                               )}
                             </div>
                           )}

                           <div className="space-y-1">
                             <div className="flex justify-between text-sm text-muted-foreground">
                               <span>Subtotal</span>
                               <span>€ {formatPriceForDisplay(cartTotal)}</span>
                             </div>
                             {distributor?.shippingConfig?.enabled && shippingMethod === 'shipping' && (
                               <div className="flex justify-between text-sm text-muted-foreground">
                                 <span>Shipping{shippingResult?.zoneName ? ` (${shippingResult.zoneName})` : ''}</span>
                                 <span>{shippingResult?.freeShippingApplied ? 'Free' : `€ ${formatPriceForDisplay(shippingCost)}`}</span>
                               </div>
                             )}
                             {shippingMethod === 'pickup' && (
                               <div className="flex justify-between text-sm text-muted-foreground">
                                 <span>Pickup</span>
                                 <span>€ 0,00</span>
                               </div>
                             )}
                             <Separator className="my-1" />
                             <div className="flex justify-between font-semibold text-lg">
                               <span>Total</span>
                               <span>€ {formatPriceForDisplay(orderTotal)}</span>
                             </div>
                           </div>
                           {distributor?.taxMode === 'manual' && distributor.manualTaxRate && (
                               <p className="text-xs text-muted-foreground text-right">
                                   {distributor.taxBehavior === 'exclusive'
                                       ? `+ ${distributor.manualTaxLabel || 'VAT'} ${distributor.manualTaxRate}% will be added`
                                       : `Incl. ${distributor.manualTaxLabel || 'VAT'} ${distributor.manualTaxRate}%`
                                   }
                               </p>
                           )}
                           {distributor?.taxMode === 'stripe_tax' && (
                               <p className="text-xs text-muted-foreground text-right">VAT will be calculated at checkout</p>
                           )}
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


"use client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatPriceForDisplay } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, FileText, ShoppingBag, CreditCard, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { createOrder } from "@/services/order-service";
import type { User } from "@/types";

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

export default function CheckoutPage() {
    const { user, cart, cartTotal, clearCart } = useAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);

    if (!user) {
        return <div/>;
    }
    
    const isAddressSet = user.addressLine1 && user.city && user.postcode && user.country;

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

        setIsPlacingOrder(true);
        try {
            const newOrder = await createOrder(user, cart);
            toast({
                title: "Order Placed!",
                description: `Your order #${newOrder.id.slice(0, 8)} has been successfully placed.`,
            });
            clearCart();
            router.push(`/my-orders`);
        } catch (error) {
            console.error("Failed to place order:", error);
            toast({
                title: "Order Failed",
                description: (error as Error).message || "There was an error placing your order. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsPlacingOrder(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
            <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                        <AddressCard title="Shipping Address" icon={Home} user={user} type="shipping"/>
                        <AddressCard title="Billing Address" icon={FileText} user={user} type="billing"/>
                    </div>
                     <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CreditCard className="h-5 w-5 text-primary"/>Payment</CardTitle></CardHeader>
                        <CardContent>
                            <div className="p-6 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                                <p>Payment provider integration (e.g., Stripe) coming soon.</p>
                                <p className="text-sm">For now, click "Place Order" to simulate the order creation.</p>
                            </div>
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

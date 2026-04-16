"use client";
import ProtectedRoute from "@/components/layout/protected-route";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingCart, ArrowRight, Download, FileDown, Info } from "lucide-react";
import { formatPriceForDisplay } from "@/lib/utils";
import { isReverseChargeApplicable, calculateTax } from "@/lib/tax-utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import jsPDF from "jspdf";
import "jspdf-autotable";
import Papa from "papaparse";

export default function CartPage() {
    const { user, cart, removeFromCart, updateCartQuantity, cartTotal, clearCart, activeDistributor } = useAuth();
    const router = useRouter();

    // Derive the tax breakdown the customer should see BEFORE checkout:
    //  - respects the distributor's taxMode (manual / stripe_tax / none)
    //  - respects inclusive vs exclusive pricing
    //  - applies reverse charge when the customer has an EU VAT number in a
    //    different EU country than the distributor (preview: based on
    //    presence of VAT number; the actual order uses VIES-verified state)
    const taxMode = activeDistributor?.taxMode || 'none';
    const taxBehavior = activeDistributor?.taxBehavior || 'inclusive';
    const taxRate = activeDistributor?.manualTaxRate || 0;
    const taxLabel = activeDistributor?.manualTaxLabel || 'VAT';

    const reverseChargePreview = isReverseChargeApplicable(
        user?.vatNumber,
        user?.country,
        activeDistributor?.country
    );
    const vatUnverifiedHint = !!user?.vatNumber && !user?.vatValidated && reverseChargePreview;

    let previewSubtotalExcl = cartTotal;
    let previewTax = 0;
    let previewTotal = cartTotal;
    if (taxMode === 'manual' && taxRate > 0) {
        const result = calculateTax(cartTotal, taxRate, taxBehavior, reverseChargePreview);
        previewSubtotalExcl = result.subtotal;
        previewTax = result.taxAmount;
        previewTotal = result.total;
    }

    const cartDistributorName = activeDistributor?.name;

    const handleDownloadPdf = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(18);
        doc.text(`Order Preview from ${cartDistributorName || 'Vinylogix'}`, 14, 22);
        doc.setFontSize(11);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);
        
        const tableColumn = ["Artist", "Title", "Qty", "Unit Price", "Total Price"];
        const tableRows: (string|number)[][] = [];

        cart.forEach(item => {
            const itemData = [
                item.record.artist,
                item.record.title,
                item.quantity,
                `€${formatPriceForDisplay(item.record.sellingPrice || 0)}`,
                `€${formatPriceForDisplay((item.record.sellingPrice || 0) * item.quantity)}`
            ];
            tableRows.push(itemData);
        });

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            theme: 'grid'
        });

        const finalY = (doc as any).lastAutoTable.finalY;
        doc.setFontSize(14);
        doc.text(`Total: €${formatPriceForDisplay(cartTotal)}`, 14, finalY + 15);
        
        doc.save(`cart_preview_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleDownloadCsv = () => {
        const dataForCsv = cart.map(item => ({
            "Artist": item.record.artist,
            "Title": item.record.title,
            "Quantity": item.quantity,
            "Unit Price (EUR)": formatPriceForDisplay(item.record.sellingPrice || 0),
            "Total Price (EUR)": formatPriceForDisplay((item.record.sellingPrice || 0) * item.quantity)
        }));

        const csv = Papa.unparse(dataForCsv);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `cart_preview_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <ProtectedRoute>
            <div className="space-y-8">
                 <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-3xl">
                            <ShoppingCart className="h-8 w-8 text-primary" />
                            <span>Your Shopping Cart</span>
                        </CardTitle>
                        <CardDescription>
                            {cart.length > 0 && cartDistributorName 
                                ? `Items from ${cartDistributorName}. You can only order from one distributor at a time.`
                                : "Review items in your cart before proceeding to checkout."
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {cart.length > 0 ? (
                            <div className="sm:hidden">
                                {cart.map(item => (
                                    <div key={item.record.id} className="flex flex-col gap-4 border-b py-4">
                                        <div className="flex items-center gap-4">
                                            <Image src={item.record.cover_url || 'https://placehold.co/80x80.png'} alt={item.record.title} width={80} height={80} className="rounded-md aspect-square object-cover"/>
                                            <div className="flex-grow">
                                                <p className="font-semibold leading-tight">{item.record.title}</p>
                                                <p className="text-sm text-muted-foreground">{item.record.artist}</p>
                                                <p className="text-sm font-medium mt-1">€ {formatPriceForDisplay(item.record.sellingPrice)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center justify-center gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateCartQuantity(item.record.id, item.quantity - 1)}><Minus className="h-4 w-4"/></Button>
                                                <Input type="number" value={item.quantity} onChange={(e) => updateCartQuantity(item.record.id, parseInt(e.target.value) || 1)} className="w-14 h-8 text-center" />
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateCartQuantity(item.record.id, item.quantity + 1)}><Plus className="h-4 w-4"/></Button>
                                            </div>
                                            <p className="font-medium">€ {formatPriceForDisplay((item.record.sellingPrice || 0) * item.quantity)}</p>
                                            <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.record.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                        {cart.length > 0 ? (
                            <Table className="hidden sm:table">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px] hidden sm:table-cell"></TableHead>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="text-center">Quantity</TableHead>
                                        <TableHead className="text-right">Price</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cart.map(item => (
                                        <TableRow key={item.record.id}>
                                            <TableCell className="hidden sm:table-cell">
                                                <Image src={item.record.cover_url || 'https://placehold.co/80x80.png'} alt={item.record.title} width={80} height={80} className="rounded-md aspect-square object-cover"/>
                                            </TableCell>
                                            <TableCell>
                                                <p className="font-medium">{item.record.title}</p>
                                                <p className="text-sm text-muted-foreground">{item.record.artist}</p>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateCartQuantity(item.record.id, item.quantity - 1)}><Minus className="h-4 w-4"/></Button>
                                                    <Input type="number" value={item.quantity} onChange={(e) => updateCartQuantity(item.record.id, parseInt(e.target.value) || 1)} className="w-14 h-8 text-center" />
                                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateCartQuantity(item.record.id, item.quantity + 1)}><Plus className="h-4 w-4"/></Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">€ {formatPriceForDisplay(item.record.sellingPrice)}</TableCell>
                                            <TableCell className="text-right font-medium">€ {formatPriceForDisplay((item.record.sellingPrice || 0) * item.quantity)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.record.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                             <div className="text-center py-16 text-muted-foreground">
                                <ShoppingCart className="mx-auto h-16 w-16 mb-4" />
                                <h3 className="text-xl font-semibold text-foreground">Your cart is empty</h3>
                                <p className="mt-2">Looks like you haven't added anything to your cart yet.</p>
                                <Button asChild className="mt-6"><Link href="/inventory">Start Shopping</Link></Button>
                            </div>
                        )}
                    </CardContent>
                    {cart.length > 0 && (
                        <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/50 p-6">
                            <div className="flex gap-2">
                               <Button variant="outline" onClick={clearCart}>Clear Cart</Button>
                               <Button variant="outline" onClick={handleDownloadPdf}><Download className="mr-2 h-4 w-4"/> Download as PDF</Button>
                               <Button variant="outline" onClick={handleDownloadCsv}><FileDown className="mr-2 h-4 w-4"/> Download as CSV</Button>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start gap-4 w-full sm:w-auto">
                                <div className="text-sm min-w-[220px] w-full sm:w-auto">
                                    {taxMode === 'manual' && taxRate > 0 ? (
                                        <>
                                            <div className="flex justify-between text-muted-foreground">
                                                <span>Subtotal excl. {taxLabel}</span>
                                                <span>€ {formatPriceForDisplay(previewSubtotalExcl)}</span>
                                            </div>
                                            <div className="flex justify-between text-muted-foreground mt-1">
                                                <span>
                                                    {reverseChargePreview
                                                        ? `${taxLabel} (Reverse charge)`
                                                        : `${taxLabel} ${taxRate}%`}
                                                </span>
                                                <span>€ {formatPriceForDisplay(previewTax)}</span>
                                            </div>
                                            <div className="flex justify-between text-xl font-semibold mt-2 pt-2 border-t">
                                                <span>Total</span>
                                                <span className="text-primary">€ {formatPriceForDisplay(previewTotal)}</span>
                                            </div>
                                            {reverseChargePreview && (
                                                <p className="text-xs text-muted-foreground italic mt-2 flex items-start gap-1">
                                                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                                    <span>{taxLabel} to be accounted for by the recipient (intra-EU reverse charge).</span>
                                                </p>
                                            )}
                                            {vatUnverifiedHint && (
                                                <p className="text-xs text-amber-600 dark:text-amber-500 italic mt-1">
                                                    Your VAT number isn't VIES-verified yet. Verify it in your profile so reverse charge is applied on the final invoice.
                                                </p>
                                            )}
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Shipping calculated at checkout based on your address.
                                            </p>
                                        </>
                                    ) : taxMode === 'stripe_tax' ? (
                                        <>
                                            <div className="flex justify-between text-xl font-semibold">
                                                <span>Subtotal</span>
                                                <span className="text-primary">€ {formatPriceForDisplay(cartTotal)}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                VAT and shipping are calculated at checkout based on your delivery address.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between text-xl font-semibold">
                                                <span>Total</span>
                                                <span className="text-primary">€ {formatPriceForDisplay(cartTotal)}</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Shipping calculated at checkout.
                                            </p>
                                        </>
                                    )}
                                </div>
                                <Button size="lg" onClick={() => router.push('/checkout')}>
                                    Proceed to Checkout <ArrowRight className="ml-2 h-5 w-5"/>
                                </Button>
                            </div>
                        </CardFooter>
                    )}
                 </Card>
            </div>
        </ProtectedRoute>
    );
}

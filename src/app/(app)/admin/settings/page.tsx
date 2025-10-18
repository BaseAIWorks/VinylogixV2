"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, AlertTriangle, Save, Shapes, ArrowLeft, Trash2, PlusCircle, Weight, Palette, CreditCard } from "lucide-react";
import type { SubscriptionInfo, SubscriptionTier, WeightOption } from "@/types";
import { SubscriptionTiers } from "@/types";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getSubscriptionTiers, updateSubscriptionTiers, getWeightOptions, updateWeightOptions } from "@/services/subscription-service";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Separator } from "@/components/ui/separator";

let weightOptionIdCounter = 0;

const brandingFormSchema = z.object({
  companyName: z.string().optional(),
  logoUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
});
type BrandingFormValues = z.infer<typeof brandingFormSchema>;


export default function PlatformSettingsPage() {
    const { user, loading: authLoading, platformBranding, updateMyDistributorSettings } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [tiers, setTiers] = useState<Record<SubscriptionTier, SubscriptionInfo> | null>(null);
    const [weightOptions, setWeightOptions] = useState<WeightOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const brandingForm = useForm<BrandingFormValues>({
      resolver: zodResolver(brandingFormSchema),
      defaultValues: {
          companyName: "",
          logoUrl: "",
      }
    });

    useEffect(() => {
        if (platformBranding) {
            brandingForm.reset({
                companyName: platformBranding.companyName,
                logoUrl: platformBranding.logoUrl,
            });
        }
    }, [platformBranding, brandingForm]);

    const fetchSettings = useCallback(async () => {
        if (!user || user.role !== 'superadmin') {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const [tiersData, weightsData] = await Promise.all([
                getSubscriptionTiers(),
                getWeightOptions()
            ]);
            setTiers(tiersData);
            setWeightOptions(weightsData.map(w => ({ ...w, id: w.id || `w_${new Date().getTime()}_${Math.random()}` })));
        } catch (error) {
            toast({ title: "Error", description: "Could not load platform settings.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (!authLoading && user?.role === 'superadmin') {
            fetchSettings();
        }
    }, [user, authLoading, fetchSettings]);

    const handleTierInputChange = (tier: SubscriptionTier, field: keyof SubscriptionInfo, value: string | number | boolean) => {
        if (!tiers) return;

        if (field === 'maxRecords' || field === 'maxUsers' || field === 'price' || field === 'yearlyPrice' || field === 'discountedPrice') {
            const numValue = Number(value);
            if (isNaN(numValue)) {
                 if (value === "") { 
                    setTiers(prev => {
                        if (!prev) return null;
                        const newTierInfo = { ...prev[tier] };
                        delete (newTierInfo as any)[field];
                        return { ...prev, [tier]: newTierInfo };
                    });
                    return;
                }
                return; 
            }
            value = numValue;
        }
        
        setTiers(prev => {
            if (!prev) return null;
            return { ...prev, [tier]: { ...prev[tier], [field]: value } };
        });
    };
    
    const handleWeightOptionChange = (index: number, field: keyof WeightOption, value: string | number | boolean) => {
        const newOptions = [...weightOptions];
        const option = { ...newOptions[index] };

        if (field === 'weight') {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                 option.weight = numValue;
            }
        } else if (field === 'isFixed') {
             option.isFixed = !!value;
        } else {
             option.label = String(value);
        }
        
        newOptions[index] = option;
        setWeightOptions(newOptions);
    };

    const handleAddWeightOption = () => {
        setWeightOptions([...weightOptions, { id: `new_${weightOptionIdCounter++}`, label: "", weight: 0, isFixed: false }]);
    };

    const handleRemoveWeightOption = (id: string) => {
        setWeightOptions(weightOptions.filter((opt) => opt.id !== id));
    };

    const handleSaveChanges = async () => {
        if (!tiers || !weightOptions) return;
        setIsSaving(true);
        try {
            await Promise.all([
                updateSubscriptionTiers(tiers),
                updateWeightOptions(weightOptions)
            ]);
            toast({ title: "Success", description: "Platform settings have been updated." });
            await fetchSettings();
        } catch (error) {
            toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleBrandingUpdate = async (values: BrandingFormValues) => {
      await updateMyDistributorSettings(values);
    };


    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    if (user?.role !== 'superadmin') {
        return (
            <div className="flex flex-col items-center justify-center text-center p-6 min-h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
                <h2 className="text-2xl font-semibold text-destructive">Access Denied</h2>
                <p className="text-muted-foreground mt-2">You must be a Super Admin to view this page.</p>
                <Button onClick={() => router.push('/dashboard')} className="mt-6"><ArrowLeft className="mr-2 h-4 w-4" /> Go to Dashboard</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div/>
                <Button onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save All Changes
                </Button>
            </div>
            
             <Tabs defaultValue="tiers" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="tiers">Subscription Tiers</TabsTrigger>
                    <TabsTrigger value="weights">Weight Options</TabsTrigger>
                    <TabsTrigger value="branding">Branding</TabsTrigger>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                </TabsList>
                <TabsContent value="tiers">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                        {tiers && SubscriptionTiers.map(tierKey => (
                            <Card key={tierKey}>
                                <CardHeader><CardTitle className="capitalize text-xl text-primary">{tierKey}</CardTitle><CardDescription>Configure the {tierKey} plan.</CardDescription></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1"><Label htmlFor={`description-${tierKey}`}>Description</Label><Input id={`description-${tierKey}`} type="text" value={tiers[tierKey].description ?? ''} onChange={e => handleTierInputChange(tierKey, 'description', e.target.value)} placeholder="e.g. For small businesses"/></div>
                                    <div className="space-y-1"><Label htmlFor={`features-${tierKey}`}>Features (one per line)</Label><Textarea id={`features-${tierKey}`} value={tiers[tierKey].features ?? ''} onChange={e => handleTierInputChange(tierKey, 'features', e.target.value)} placeholder={"Feature 1\nFeature 2\nFeature 3"} rows={4}/></div>
                                    <div className="space-y-1"><Label htmlFor={`maxRecords-${tierKey}`}>Max Records</Label><Input id={`maxRecords-${tierKey}`} type="number" value={tiers[tierKey].maxRecords} onChange={e => handleTierInputChange(tierKey, 'maxRecords', e.target.value)} placeholder="Use -1 for unlimited"/><p className="text-xs text-muted-foreground">Use -1 for unlimited records.</p></div>
                                    <div className="space-y-1"><Label htmlFor={`maxUsers-${tierKey}`}>Max Users</Label><Input id={`maxUsers-${tierKey}`} type="number" value={tiers[tierKey].maxUsers} onChange={e => handleTierInputChange(tierKey, 'maxUsers', e.target.value)} placeholder="Use -1 for unlimited"/><p className="text-xs text-muted-foreground">Use -1 for unlimited users.</p></div>
                                    <div className="space-y-1"><Label htmlFor={`price-${tierKey}`}>Monthly Price (€)</Label><Input id={`price-${tierKey}`} type="number" step="0.01" value={tiers[tierKey].price ?? ''} onChange={e => handleTierInputChange(tierKey, 'price', e.target.value)} placeholder="e.g. 29.99"/></div>
                                    <div className="space-y-1"><Label htmlFor={`yearlyPrice-${tierKey}`}>Yearly Price (€)</Label><Input id={`yearlyPrice-${tierKey}`} type="number" step="0.01" value={tiers[tierKey].yearlyPrice ?? ''} onChange={e => handleTierInputChange(tierKey, 'yearlyPrice', e.target.value)} placeholder="e.g. 290.00"/></div>
                                    <div className="space-y-1"><Label htmlFor={`discountedPrice-${tierKey}`}>Offer Price (€)</Label><Input id={`discountedPrice-${tierKey}`} type="number" step="0.01" value={tiers[tierKey].discountedPrice ?? ''} onChange={e => handleTierInputChange(tierKey, 'discountedPrice', e.target.value)} placeholder="e.g. 24.99"/><p className="text-xs text-muted-foreground">Optional discounted monthly price.</p></div>
                                    <div className="flex items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><Label htmlFor={`allowOrders-${tierKey}`}>Allow Orders</Label></div><Switch id={`allowOrders-${tierKey}`} checked={tiers[tierKey].allowOrders} onCheckedChange={checked => handleTierInputChange(tierKey, 'allowOrders', checked)}/></div>
                                    <div className="flex items-center justify-between rounded-lg border p-3"><div className="space-y-0.5"><Label htmlFor={`allowAiFeatures-${tierKey}`}>Allow AI Features</Label></div><Switch id={`allowAiFeatures-${tierKey}`} checked={tiers[tierKey].allowAiFeatures} onCheckedChange={checked => handleTierInputChange(tierKey, 'allowAiFeatures', checked)}/></div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
                 <TabsContent value="weights">
                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3"><Weight className="h-5 w-5"/> Predefined Weight Options</CardTitle>
                            <CardDescription>Manage the dropdown options for record weights. Fixed weights are not editable on the record form.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {weightOptions.map((option, index) => (
                                <div key={option.id || index} className="flex flex-col sm:flex-row items-end gap-4 p-4 border rounded-lg">
                                    <div className="flex-1 space-y-2">
                                        <Label htmlFor={`weight-label-${index}`}>Label</Label>
                                        <Input id={`weight-label-${index}`} value={option.label} onChange={(e) => handleWeightOptionChange(index, 'label', e.target.value)} placeholder="e.g. Single LP (180g)"/>
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <Label htmlFor={`weight-value-${index}`}>Weight (grams)</Label>
                                        <Input id={`weight-value-${index}`} type="number" value={option.weight} onChange={(e) => handleWeightOptionChange(index, 'weight', e.target.value)} placeholder="e.g. 320"/>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center space-x-2 pt-2">
                                            <Switch id={`weight-fixed-${index}`} checked={option.isFixed} onCheckedChange={(checked) => handleWeightOptionChange(index, 'isFixed', checked)}/>
                                            <Label htmlFor={`weight-fixed-${index}`}>Fixed</Label>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => handleRemoveWeightOption(option.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </div>
                                </div>
                            ))}
                             <Button variant="outline" onClick={handleAddWeightOption}><PlusCircle className="mr-2 h-4 w-4"/> Add Option</Button>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="branding">
                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3"><Palette className="h-5 w-5"/> Platform Branding</CardTitle>
                            <CardDescription>Customize the application name and logo for the entire platform.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...brandingForm}>
                                <form onSubmit={brandingForm.handleSubmit(handleBrandingUpdate)} className="space-y-6">
                                <FormField control={brandingForm.control} name="companyName" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Platform Name</FormLabel>
                                        <FormControl><Input placeholder="Your Company Name" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={brandingForm.control} name="logoUrl" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Logo URL</FormLabel>
                                        <FormControl><Input placeholder="https://example.com/logo.png" {...field} /></FormControl>
                                        <FormDescription>Enter a direct URL to your logo image. It should be a square image (e.g., PNG, JPG).</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <Button type="submit" disabled={brandingForm.formState.isSubmitting || authLoading}>
                                        {brandingForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Branding
                                </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="payments">
                     <Card className="mt-4">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3"><CreditCard className="h-5 w-5"/> Payment Settings</CardTitle>
                            <CardDescription>Configure payment providers and platform transaction fees.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             <div className="p-6 border rounded-lg space-y-4">
                                <h4 className="font-semibold text-foreground">Transaction Fees</h4>
                                <div className="space-y-2">
                                    <Label htmlFor="application_fee">Platform Fee (%)</Label>
                                    <Input id="application_fee" type="number" step="0.1" placeholder="e.g. 2.5" />
                                    <p className="text-xs text-muted-foreground">The percentage your platform will take from each successful transaction via Stripe Connect.</p>
                                </div>
                             </div>
                             <div className="p-6 border rounded-lg space-y-4">
                                <h4 className="font-semibold text-foreground">Available Payment Providers</h4>
                                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <Label htmlFor="enable_stripe">Enable Stripe</Label>
                                    <Switch id="enable_stripe" defaultChecked/>
                                </div>
                                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <Label htmlFor="enable_paypal">Enable PayPal</Label>
                                    <Switch id="enable_paypal" disabled />
                                </div>
                                 <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <Label htmlFor="enable_paynl">Enable Pay.nl</Label>
                                    <Switch id="enable_paynl" disabled />
                                </div>
                             </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

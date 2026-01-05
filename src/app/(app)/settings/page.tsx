

"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCircle, Bell, DatabaseZap, Palette, LogOut, Loader2, Save, Home, KeyRound, View, Link as LinkIcon, MenuSquare, Check, AlertCircle, ExternalLink, CreditCard, FileDown, X, Building2, Package, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { UserRole, Distributor, CardDisplaySettings, ClientMenuSettings } from "@/types";
import { format, differenceInDays, addMonths } from 'date-fns';
import { getInventoryRecords } from "@/services/record-service";
import { formatPriceForDisplay } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";


const profileFormSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  companyName: z.string().optional(),
  phoneNumber: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  postcode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  useDifferentBillingAddress: z.boolean().optional(),
  billingAddress: z.string().optional(),
}).refine(data => {
    if (data.useDifferentBillingAddress && !data.billingAddress) {
        return false;
    }
    return true;
}, {
    message: "Billing address cannot be empty if it's different from the shipping address.",
    path: ["billingAddress"],
});

const brandingFormSchema = z.object({
  companyName: z.string().optional(),
  logoUrl: z.string().url("Must be a valid URL").or(z.literal("")).optional(),
});

const distributorSettingsSchema = z.object({
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen."),
  profileComplete: z.boolean().optional(),
});


const notificationsFormSchema = z.object({
  lowStockNotificationsEnabled: z.boolean().default(false),
  lowStockThreshold: z.string().optional(),
});

const cardDisplayFormSchema = z.object({
    showTitle: z.boolean().default(true),
    showArtist: z.boolean().default(true),
    showYear: z.boolean().default(false),
    showCountry: z.boolean().default(false),
    showShelfStock: z.boolean().default(true),
    showStorageStock: z.boolean().default(true),
    showTotalStock: z.boolean().default(true),
    showFormat: z.boolean().default(false),
});

const clientMenuFormSchema = z.object({
    showCollection: z.boolean().default(true),
    showWishlist: z.boolean().default(true),
    showScan: z.boolean().default(true),
    showDiscogs: z.boolean().default(true),
});


type ProfileFormValues = z.infer<typeof profileFormSchema>;
type BrandingFormValues = z.infer<typeof brandingFormSchema>;
type DistributorSettingsValues = z.infer<typeof distributorSettingsSchema>;
type NotificationsFormValues = z.infer<typeof notificationsFormSchema>;
type CardDisplayFormValues = z.infer<typeof cardDisplayFormSchema>;
type ClientMenuFormValues = z.infer<typeof clientMenuFormSchema>;


const roleDisplayNames: Record<UserRole, string> = {
  master: 'Master',
  worker: 'Operator',
  viewer: 'Client',
  superadmin: 'Super Admin',
};

const countries = [ "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe" ];

const LocationManager = ({ title, locations, onUpdateLocations }: { title: string; locations: string[]; onUpdateLocations: (newLocations: string[]) => void; }) => {
    const [newLocation, setNewLocation] = useState("");

    const handleAdd = () => {
        const trimmed = newLocation.trim();
        if (trimmed && !locations.includes(trimmed)) {
            const updated = [...locations, trimmed].sort((a,b) => a.localeCompare(b));
            onUpdateLocations(updated);
            setNewLocation("");
        }
    };

    const handleRemove = (locToRemove: string) => {
        const updated = locations.filter(loc => loc !== locToRemove);
        onUpdateLocations(updated);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleAdd();
        }
    };

    return (
        <div className="space-y-3">
            <h4 className="font-medium">{title}</h4>
            <div className="space-y-2">
                <div className="flex gap-2">
                    <Input
                        value={newLocation}
                        onChange={(e) => setNewLocation(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Add new location..."
                    />
                    <Button type="button" onClick={handleAdd}>Add</Button>
                </div>
            </div>
             <div className="rounded-lg border p-3 min-h-[80px]">
                {locations.length > 0 ? (
                    <ul className="space-y-2">
                        {locations.map(loc => (
                            <li key={loc} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-sm">
                                <span>{loc}</span>
                                <button onClick={() => handleRemove(loc)} className="rounded-full p-0.5 text-destructive/70 hover:bg-destructive/20 hover:text-destructive">
                                    <X className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground p-2">No predefined locations yet.</p>
                )}
            </div>
        </div>
    );
};


export default function SettingsPage() {
  const { user, logout, updateUserProfile, sendPasswordReset, loading: authLoading, displayBranding, updateMyDistributorSettings, activeDistributor } = useAuth();
  const [isExportingCSV, setIsExportingCSV] = useState(false);
  
  const [shelfLocations, setShelfLocations] = useState<string[]>([]);
  const [storageLocations, setStorageLocations] = useState<string[]>([]);
  const [isSavingLocations, setIsSavingLocations] = useState(false);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [isConnectingPayPal, setIsConnectingPayPal] = useState(false);
  const [isProfileCompletionDialogOpen, setIsProfileCompletionDialogOpen] = useState(false);


  const { toast } = useToast();
  const router = useRouter();


  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      phoneNumber: "",
      addressLine1: "",
      addressLine2: "",
      postcode: "",
      city: "",
      country: "",
      useDifferentBillingAddress: false,
      billingAddress: "",
    },
  });

  const brandingForm = useForm<BrandingFormValues>({
      resolver: zodResolver(brandingFormSchema),
      defaultValues: {
          companyName: "",
          logoUrl: "",
      }
  });
  
  const distributorSettingsForm = useForm<DistributorSettingsValues>({
    resolver: zodResolver(distributorSettingsSchema),
    defaultValues: {
      slug: ""
    }
  });

  const notificationsForm = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues: {
        lowStockNotificationsEnabled: false,
        lowStockThreshold: "20",
    }
  });

  const defaultCardSettings: CardDisplaySettings = {
    showTitle: true,
    showArtist: true,
    showYear: false,
    showCountry: false,
    showShelfStock: true,
    showStorageStock: true,
    showTotalStock: true,
    showFormat: false,
  };
  
  const cardDisplayForm = useForm<CardDisplayFormValues>({
      resolver: zodResolver(cardDisplayFormSchema),
      defaultValues: defaultCardSettings
  });

  const defaultClientMenuSettings: ClientMenuSettings = {
      showCollection: true,
      showWishlist: true,
      showScan: true,
      showDiscogs: true,
  };

  const clientMenuForm = useForm<ClientMenuFormValues>({
      resolver: zodResolver(clientMenuFormSchema),
      defaultValues: defaultClientMenuSettings,
  });

  useEffect(() => {
    if (user) {
        profileForm.reset({
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            companyName: user.companyName || "",
            phoneNumber: user.phoneNumber || "",
            addressLine1: user.addressLine1 || "",
            addressLine2: user.addressLine2 || "",
            postcode: user.postcode || "",
            city: user.city || "",
            country: user.country || "",
            useDifferentBillingAddress: user.useDifferentBillingAddress || false,
            billingAddress: user.billingAddress || "",
        });
    }
  }, [user, profileForm]);

  useEffect(() => {
    if (displayBranding) {
        brandingForm.reset({
            companyName: displayBranding.companyName,
            logoUrl: displayBranding.logoUrl,
        });
    }
  }, [displayBranding, brandingForm]);

  useEffect(() => {
    if (activeDistributor) {
        notificationsForm.reset({
            lowStockNotificationsEnabled: activeDistributor.lowStockNotificationsEnabled || false,
            lowStockThreshold: activeDistributor.lowStockThreshold?.toString() || "20",
        });
        distributorSettingsForm.reset({
          slug: activeDistributor.slug || "",
        });
        setShelfLocations(activeDistributor.shelfLocations || []);
        setStorageLocations(activeDistributor.storageLocations || []);
        cardDisplayForm.reset({
            ...defaultCardSettings,
            ...(activeDistributor.cardDisplaySettings || {}),
        });
        clientMenuForm.reset({
            ...defaultClientMenuSettings,
            ...(activeDistributor.clientMenuSettings || {}),
        });
        
        if (activeDistributor.profileComplete === false) {
          setIsProfileCompletionDialogOpen(true);
        }
    }
  }, [activeDistributor, notificationsForm, distributorSettingsForm, cardDisplayForm, clientMenuForm]);


  const useDifferentBilling = profileForm.watch("useDifferentBillingAddress");
  const lowStockEnabled = notificationsForm.watch("lowStockNotificationsEnabled");

  const handleProfileUpdate = async (values: ProfileFormValues) => {
    await updateUserProfile(values);
  };
  
  const handleProfileCompletion = async (values: ProfileFormValues) => {
    // Save the user profile data first
    await updateUserProfile(values);
    // Then mark the distributor profile as complete
    await updateMyDistributorSettings({ profileComplete: true });
    setIsProfileCompletionDialogOpen(false);
  };

  const handleBrandingUpdate = async (values: BrandingFormValues) => {
      await updateMyDistributorSettings({ ...values });
  };
  
  const handleDistributorSettingsUpdate = async (values: DistributorSettingsValues) => {
    await updateMyDistributorSettings(values);
  };

  const handleNotificationsUpdate = async (values: NotificationsFormValues) => {
      await updateMyDistributorSettings({
        lowStockNotificationsEnabled: values.lowStockNotificationsEnabled,
        lowStockThreshold: values.lowStockThreshold ? parseInt(values.lowStockThreshold, 10) : undefined,
      });
  };
  
  const handleCardDisplayUpdate = async (values: CardDisplayFormValues) => {
      await updateMyDistributorSettings({ cardDisplaySettings: values });
  };

  const handleClientMenuUpdate = async (values: ClientMenuFormValues) => {
      await updateMyDistributorSettings({ clientMenuSettings: values });
  }

  const handleUpdateLocations = async () => {
    setIsSavingLocations(true);
    await updateMyDistributorSettings({ shelfLocations, storageLocations });
    setIsSavingLocations(false);
  };

  const handleStripeConnect = async () => {
    if (!user || !user.distributorId) {
        toast({ title: "Error", description: "Distributor context not found.", variant: "destructive" });
        return;
    }

    // Get the current user's ID token for authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
        toast({ title: "Error", description: "You must be logged in to connect Stripe.", variant: "destructive" });
        return;
    }

    setIsConnectingStripe(true);
    try {
        // Get a fresh ID token
        const idToken = await currentUser.getIdToken(true);

        const response = await fetch('/api/stripe/connect/onboard', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ distributorId: user.distributorId, distributorEmail: user.email }),
        });
        const { url, error } = await response.json();
        if (error) {
            throw new Error(error);
        }
        if (url) {
            window.location.href = url;
        } else {
            throw new Error("Could not retrieve Stripe onboarding URL.");
        }
    } catch (error) {
        toast({ title: "Stripe Connection Failed", description: (error as Error).message, variant: "destructive" });
        setIsConnectingStripe(false);
    }
  };

  const handlePayPalConnect = async () => {
    if (!user || !user.distributorId) {
        toast({ title: "Error", description: "Distributor context not found.", variant: "destructive" });
        return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        toast({ title: "Error", description: "You must be logged in to connect PayPal.", variant: "destructive" });
        return;
    }

    setIsConnectingPayPal(true);
    try {
        const idToken = await currentUser.getIdToken(true);

        const response = await fetch('/api/paypal/connect/onboard', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ distributorId: user.distributorId, distributorEmail: user.email }),
        });
        const { url, error } = await response.json();
        if (error) {
            throw new Error(error);
        }
        if (url) {
            window.location.href = url;
        } else {
            throw new Error("Could not retrieve PayPal onboarding URL.");
        }
    } catch (error) {
        toast({ title: "PayPal Connection Failed", description: (error as Error).message, variant: "destructive" });
        setIsConnectingPayPal(false);
    }
  };

  const escapeCSVValue = (value: any): string => {
    if (value === null || value === undefined) {
      return "";
    }
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const handleExportCSV = async () => {
    if (!user || user.role !== 'master' || !user.distributorId) {
      toast({ title: "Permission Denied", description: "Only master users can export data.", variant: "destructive" });
      return;
    }
    setIsExportingCSV(true);
    toast({ title: "Exporting Data", description: "Preparing your CSV file..." });

    try {
      const { records } = await getInventoryRecords(user, { distributorId: user.distributorId });
      if (records.length === 0) {
        toast({ title: "No Data", description: "There are no records to export.", variant: "default" });
        setIsExportingCSV(false);
        return;
      }

      const totalRecords = records.length;
      const totalItems = records.reduce((sum, r) => {
        const shelves = Number(r.stock_shelves || 0);
        const storage = Number(r.stock_storage || 0);
        return sum + shelves + storage;
      }, 0);

      const totalPurchasingValue = records.reduce((sum, r) => {
        const totalStock = (r.stock_shelves || 0) + (r.stock_storage || 0);
        return sum + ((r.purchasingPrice || 0) * totalStock);
      }, 0);
      const totalSellingValue = records.reduce((sum, r) => {
        const totalStock = (r.stock_shelves || 0) + (r.stock_storage || 0);
        return sum + ((r.sellingPrice || 0) * totalStock);
      }, 0);
      const exportDateTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

      const summaryLines = [
        `"Vinylogix Version:","v1.0.0"`,
        `"Export Date:","${exportDateTime}"`,
        `"Total Unique Records:","${totalRecords}"`,
        `"Total Items in Stock:","${totalItems}"`,
        `"Total Purchasing Value (EUR):","${formatPriceForDisplay(totalPurchasingValue)}"`,
        `"Total Selling Value (EUR):","${formatPriceForDisplay(totalSellingValue)}"`,
        ""
      ];

      const headers = [
        "ID", "Title", "Artist", "Label", "Year", "Genre", "Style", "Format Details", 
        "Media Condition", "Sleeve Condition", "Stock (Shelves)", "Shelf Location",
        "Stock (Storage)", "Storage Location", "Purchasing Price (EUR)", "Selling Price (EUR)",
        "Barcode", "Discogs ID", "Notes", "Added At", "Added By", "Last Modified At",
        "Last Modified By", "Cover URL", "Supplier ID", "Weight (g)", "Weight Option ID"
      ];

      const csvHeader = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');

      const csvRows = records.map(record => {
        const rowData = [
          record.id,
          record.title,
          record.artist,
          record.label,
          record.year,
          Array.isArray(record.genre) ? record.genre.join('; ') : '',
          Array.isArray(record.style) ? record.style.join('; ') : '',
          record.formatDetails,
          record.media_condition,
          record.sleeve_condition,
          record.stock_shelves,
          record.shelf_location,
          record.stock_storage,
          record.storage_location,
          formatPriceForDisplay(record.purchasingPrice),
          formatPriceForDisplay(record.sellingPrice),
          record.barcode,
          record.discogs_id,
          record.notes,
          record.added_at ? format(new Date(record.added_at), 'yyyy-MM-dd HH:mm:ss') : '',
          record.added_by_email,
          record.last_modified_at && record.last_modified_at !== record.added_at ? format(new Date(record.last_modified_at), 'yyyy-MM-dd HH:mm:ss') : '',
          record.last_modified_by_email,
          record.cover_url,
          record.supplierId,
          record.weight,
          record.weightOptionId
        ];
        return rowData.map(val => escapeCSVValue(val)).join(',');
      });

      const csvString = `${summaryLines.join('\n')}\n${csvHeader}\n${csvRows.join('\n')}`;
      const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' }); 
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'vinyl_collection_export.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: "Export Successful", description: "Your CSV file has been downloaded." });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast({ title: "Export Failed", description: "Could not export data. Check console for details.", variant: "destructive" });
    } finally {
      setIsExportingCSV(false);
    }
  };
  
  const canUpdateSlug = () => {
    if (!activeDistributor?.slugLastUpdatedAt) return true; // Can always set it the first time
    const lastUpdate = new Date(activeDistributor.slugLastUpdatedAt);
    return differenceInDays(new Date(), lastUpdate) >= 30;
  };
  
  const getNextSlugUpdateDate = () => {
    if (!activeDistributor?.slugLastUpdatedAt) return null;
    const nextDate = addMonths(new Date(activeDistributor.slugLastUpdatedAt), 1);
    return format(nextDate, 'PPP');
  };

  if (authLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const isMaster = user?.role === 'master';
  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <div className="max-w-4xl mx-auto">
        {/* Profile Completion Dialog */}
        {isMaster && (
          <Dialog open={isProfileCompletionDialogOpen}>
            <DialogContent className="sm:max-w-lg [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()}>
              <DialogHeader>
                  <DialogTitle>Welcome! Complete Your Business Profile</DialogTitle>
                  <DialogDescription>
                      To ensure your customers have all the necessary details and for invoicing purposes, please complete your business profile.
                  </DialogDescription>
              </DialogHeader>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(handleProfileCompletion)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={profileForm.control} name="companyName" render={({ field }) => (
                          <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                       <FormField control={profileForm.control} name="phoneNumber" render={({ field }) => (
                          <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                  </div>
                  <FormField control={profileForm.control} name="addressLine1" render={({ field }) => (
                      <FormItem><FormLabel>Address Line 1</FormLabel><FormControl><Input placeholder="Street and number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={profileForm.control} name="postcode" render={({ field }) => (
                          <FormItem><FormLabel>Postcode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={profileForm.control} name="city" render={({ field }) => (
                          <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                  </div>
                  <FormField control={profileForm.control} name="country" render={({ field }) => (
                     <FormItem><FormLabel>Country</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a country" /></SelectTrigger></FormControl><SelectContent>{countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                  )} />
                  <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background py-4">
                      <Button type="submit" disabled={profileForm.formState.isSubmitting}>
                          {profileForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Save Business Details
                      </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}

        <Tabs defaultValue={isMaster || isSuperAdmin ? "business" : "account"} className="w-full">
          <TabsList className={`grid w-full mb-6 ${isMaster ? 'grid-cols-4' : isSuperAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {(isMaster || isSuperAdmin) && (
              <TabsTrigger value="business" className="gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Business</span>
              </TabsTrigger>
            )}
            {isMaster && (
              <TabsTrigger value="inventory" className="gap-2">
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Inventory</span>
              </TabsTrigger>
            )}
            {isMaster && (
              <TabsTrigger value="clients" className="gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Clients</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="account" className="gap-2">
              <UserCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Account</span>
            </TabsTrigger>
          </TabsList>

          {/* ==================== BUSINESS TAB ==================== */}
          {(isMaster || isSuperAdmin) && (
            <TabsContent value="business" className="space-y-6">
              {/* Branding Section */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <Palette className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Branding</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Form {...brandingForm}>
                    <form onSubmit={brandingForm.handleSubmit(handleBrandingUpdate)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={brandingForm.control} name="companyName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{isSuperAdmin ? 'Platform Name' : 'Company Name'}</FormLabel>
                                <FormControl><Input placeholder="Your Company Name" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={brandingForm.control} name="logoUrl" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Logo URL</FormLabel>
                                <FormControl><Input placeholder="https://example.com/logo.png" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                      </div>
                      <Button type="submit" size="sm" disabled={brandingForm.formState.isSubmitting || authLoading}>
                          {brandingForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Save Branding
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Distributor URL - Master only */}
              {isMaster && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <LinkIcon className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Public URL</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Form {...distributorSettingsForm}>
                      <form onSubmit={distributorSettingsForm.handleSubmit(handleDistributorSettingsUpdate)} className="space-y-4">
                        <FormField control={distributorSettingsForm.control} name="slug" render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center">
                              <span className="text-sm text-muted-foreground rounded-l-md border border-r-0 bg-muted px-3 py-2 h-10 flex items-center">
                                vinylogix.com/
                              </span>
                              <FormControl>
                                <Input {...field} placeholder="your-store-name" className="rounded-l-none max-w-xs" disabled={!canUpdateSlug()} />
                              </FormControl>
                              <Button type="submit" size="sm" className="ml-2" disabled={distributorSettingsForm.formState.isSubmitting || authLoading || !canUpdateSlug()}>
                                {distributorSettingsForm.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              </Button>
                            </div>
                            <FormDescription className="text-xs">
                              {!canUpdateSlug()
                                ? `You can change your URL again after ${getNextSlugUpdateDate()}.`
                                : 'Lowercase letters, numbers, and hyphens only. Cannot be changed for 30 days.'
                              }
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              )}

              {/* Payouts & Billing - Master only */}
              {isMaster && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Payment Providers</CardTitle>
                    </div>
                    <CardDescription className="text-sm">Connect payment providers to receive payments from your customers.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Stripe Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-[#635BFF] rounded flex items-center justify-center">
                          <span className="text-white font-bold text-xs">S</span>
                        </div>
                        <span className="font-medium">Stripe</span>
                      </div>
                      {activeDistributor?.stripeAccountId ? (
                        <div className="flex items-center justify-between pl-10">
                          <div>
                            {activeDistributor.stripeAccountStatus === 'verified' ? (
                              <div className="flex items-center gap-2 text-green-600">
                                <Check className="h-4 w-4"/>
                                <span className="font-medium text-sm">Connected & verified</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-orange-600">
                                <AlertCircle className="h-4 w-4"/>
                                <span className="font-medium text-sm">Account needs attention</span>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              ID: <code className="bg-muted px-1 rounded">{activeDistributor.stripeAccountId}</code>
                            </p>
                          </div>
                          <Button onClick={handleStripeConnect} disabled={isConnectingStripe} size="sm" variant="outline">
                            {isConnectingStripe && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Manage <ExternalLink className="ml-1 h-3 w-3"/>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pl-10">
                          <p className="text-sm text-muted-foreground">Accept credit/debit cards via Stripe.</p>
                          <Button onClick={handleStripeConnect} disabled={isConnectingStripe} size="sm">
                            {isConnectingStripe && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Connect Stripe
                          </Button>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* PayPal Section */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-[#003087] rounded flex items-center justify-center">
                          <span className="text-white font-bold text-xs">P</span>
                        </div>
                        <span className="font-medium">PayPal</span>
                      </div>
                      {activeDistributor?.paypalMerchantId ? (
                        <div className="flex items-center justify-between pl-10">
                          <div>
                            {activeDistributor.paypalAccountStatus === 'verified' ? (
                              <div className="flex items-center gap-2 text-green-600">
                                <Check className="h-4 w-4"/>
                                <span className="font-medium text-sm">Connected & verified</span>
                              </div>
                            ) : activeDistributor.paypalAccountStatus === 'restricted' ? (
                              <div className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="h-4 w-4"/>
                                <span className="font-medium text-sm">Account restricted</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-orange-600">
                                <AlertCircle className="h-4 w-4"/>
                                <span className="font-medium text-sm">Verification pending</span>
                              </div>
                            )}
                            {activeDistributor.paypalEmail && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Email: <code className="bg-muted px-1 rounded">{activeDistributor.paypalEmail}</code>
                              </p>
                            )}
                          </div>
                          <Button onClick={handlePayPalConnect} disabled={isConnectingPayPal} size="sm" variant="outline">
                            {isConnectingPayPal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Manage <ExternalLink className="ml-1 h-3 w-3"/>
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pl-10">
                          <p className="text-sm text-muted-foreground">Accept PayPal payments from your customers.</p>
                          <Button onClick={handlePayPalConnect} disabled={isConnectingPayPal} size="sm">
                            {isConnectingPayPal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Connect PayPal
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* ==================== INVENTORY TAB ==================== */}
          {isMaster && (
            <TabsContent value="inventory" className="space-y-6">
              {/* Card Display Settings */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <View className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Card Display</CardTitle>
                  </div>
                  <CardDescription className="text-sm">Choose which details to show on record cards.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...cardDisplayForm}>
                    <form onSubmit={cardDisplayForm.handleSubmit(handleCardDisplayUpdate)} className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <FormField control={cardDisplayForm.control} name="showTitle" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Title</FormLabel></FormItem>
                        )}/>
                        <FormField control={cardDisplayForm.control} name="showArtist" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Artist</FormLabel></FormItem>
                        )}/>
                        <FormField control={cardDisplayForm.control} name="showYear" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Year</FormLabel></FormItem>
                        )}/>
                        <FormField control={cardDisplayForm.control} name="showCountry" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Country</FormLabel></FormItem>
                        )}/>
                        <FormField control={cardDisplayForm.control} name="showShelfStock" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Shelf Stock</FormLabel></FormItem>
                        )}/>
                        <FormField control={cardDisplayForm.control} name="showStorageStock" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Storage Stock</FormLabel></FormItem>
                        )}/>
                        <FormField control={cardDisplayForm.control} name="showTotalStock" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Total Stock</FormLabel></FormItem>
                        )}/>
                        <FormField control={cardDisplayForm.control} name="showFormat" render={({ field }) => (
                            <FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="text-sm font-normal">Format</FormLabel></FormItem>
                        )}/>
                      </div>
                      <Button type="submit" size="sm" disabled={cardDisplayForm.formState.isSubmitting || authLoading}>
                        {cardDisplayForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Storage Locations */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <DatabaseZap className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Storage Locations</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <LocationManager title="Shelf Locations" locations={shelfLocations} onUpdateLocations={setShelfLocations} />
                    <LocationManager title="Storage Locations" locations={storageLocations} onUpdateLocations={setStorageLocations} />
                  </div>
                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleUpdateLocations} size="sm" disabled={isSavingLocations || authLoading}>
                      {isSavingLocations ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Locations
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Export Data */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileDown className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Export Data</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={isExportingCSV}>
                      {isExportingCSV ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                      Export CSV
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            </TabsContent>
          )}

          {/* ==================== CLIENTS TAB ==================== */}
          {isMaster && (
            <TabsContent value="clients" className="space-y-6">
              {/* Client Menu Settings */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <MenuSquare className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Client Menu Visibility</CardTitle>
                  </div>
                  <CardDescription className="text-sm">Control which features your clients can access.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...clientMenuForm}>
                    <form onSubmit={clientMenuForm.handleSubmit(handleClientMenuUpdate)} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField control={clientMenuForm.control} name="showCollection" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <FormLabel className="text-sm font-normal">My Collection</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={clientMenuForm.control} name="showWishlist" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <FormLabel className="text-sm font-normal">Wishlist</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={clientMenuForm.control} name="showScan" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <FormLabel className="text-sm font-normal">Scan/Add Record</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />
                        <FormField control={clientMenuForm.control} name="showDiscogs" render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                            <FormLabel className="text-sm font-normal">Discogs</FormLabel>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <Button type="submit" size="sm" disabled={clientMenuForm.formState.isSubmitting || authLoading}>
                        {clientMenuForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Menu Settings
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Notifications</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <Form {...notificationsForm}>
                    <form onSubmit={notificationsForm.handleSubmit(handleNotificationsUpdate)} className="space-y-4">
                      <FormField control={notificationsForm.control} name="lowStockNotificationsEnabled" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Low Stock Alerts</FormLabel>
                            <FormDescription className="text-xs">Get notified when stock drops below threshold.</FormDescription>
                          </div>
                          <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      {lowStockEnabled && (
                        <FormField control={notificationsForm.control} name="lowStockThreshold" render={({ field }) => (
                          <FormItem className="max-w-xs">
                            <FormLabel className="text-sm">Threshold</FormLabel>
                            <FormControl><Input type="number" placeholder="e.g., 20" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      )}
                      <Button type="submit" size="sm" disabled={notificationsForm.formState.isSubmitting || authLoading}>
                        {notificationsForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ==================== ACCOUNT TAB ==================== */}
          <TabsContent value="account" className="space-y-6">
            {/* Profile */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <UserCircle className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-lg">My Profile</CardTitle>
                    <CardDescription className="text-sm">Role: <span className="font-medium">{user?.role ? roleDisplayNames[user.role] : ''}</span></CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label htmlFor="email" className="text-sm">Email</Label>
                    <Input id="email" type="email" value={user?.email || ""} disabled className="mt-1" />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => user?.email && sendPasswordReset(user.email)} className="mt-6">
                    <KeyRound className="mr-2 h-4 w-4"/>
                    Reset Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* My Details */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <Home className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Contact & Address</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Form {...profileForm}>
                  <form onSubmit={profileForm.handleSubmit(handleProfileUpdate)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={profileForm.control} name="firstName" render={({ field }) => (
                        <FormItem><FormLabel className="text-sm">First Name</FormLabel><FormControl><Input placeholder="First Name" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={profileForm.control} name="lastName" render={({ field }) => (
                        <FormItem><FormLabel className="text-sm">Last Name</FormLabel><FormControl><Input placeholder="Last Name" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={profileForm.control} name="companyName" render={({ field }) => (
                        <FormItem><FormLabel className="text-sm">Company Name</FormLabel><FormControl><Input placeholder="Company Name" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={profileForm.control} name="phoneNumber" render={({ field }) => (
                        <FormItem><FormLabel className="text-sm">Phone Number</FormLabel><FormControl><Input placeholder="Phone Number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>

                    <Separator className="my-4" />
                    <h4 className="text-sm font-medium">Shipping Address</h4>

                    <FormField control={profileForm.control} name="addressLine1" render={({ field }) => (
                      <FormItem><FormLabel className="text-sm">Address Line 1</FormLabel><FormControl><Input placeholder="Street and number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={profileForm.control} name="addressLine2" render={({ field }) => (
                      <FormItem><FormLabel className="text-sm">Address Line 2</FormLabel><FormControl><Input placeholder="Apartment, suite, etc." {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField control={profileForm.control} name="postcode" render={({ field }) => (
                        <FormItem><FormLabel className="text-sm">Postcode</FormLabel><FormControl><Input placeholder="Postcode" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={profileForm.control} name="city" render={({ field }) => (
                        <FormItem><FormLabel className="text-sm">City</FormLabel><FormControl><Input placeholder="City" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={profileForm.control} name="country" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Country</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                            <SelectContent>{countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    {user?.role === 'viewer' && (
                      <>
                        <Separator className="my-4" />
                        <FormField control={profileForm.control} name="useDifferentBillingAddress" render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            <FormLabel className="text-sm font-normal">Use a different billing address</FormLabel>
                          </FormItem>
                        )} />
                        {useDifferentBilling && (
                          <FormField control={profileForm.control} name="billingAddress" render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Billing Address</FormLabel>
                              <FormControl><Textarea placeholder="Full billing address" {...field} value={field.value ?? ''} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                        )}
                      </>
                    )}

                    <Button type="submit" size="sm" disabled={profileForm.formState.isSubmitting || authLoading}>
                      {profileForm.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Details
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Logout */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Sign Out</p>
                    <p className="text-xs text-muted-foreground">End your current session</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={logout}>
                    <LogOut className="mr-2 h-4 w-4" /> Log Out
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
}

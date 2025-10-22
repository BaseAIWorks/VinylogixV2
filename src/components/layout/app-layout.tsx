

"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarMenuBadge,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { LayoutDashboard, ScanLine, BarChart3, Settings, LogOut, Menu, Heart, Package, ShoppingCart, Boxes, Library, ListChecks, Bell, Building, Check, Key, X, Shapes, Users, Briefcase, FileUp, Palette, Disc3, DollarSign, HardHat, Activity, FilePenLine, Store, ChevronsUpDown, Truck, Settings2, CreditCard, Newspaper } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import Image from 'next/image';
import type { UserRole } from '@/types';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { Textarea } from '../ui/textarea';
import { GlobalSearch } from './global-search';
import { Separator } from "@/components/ui/separator";


interface AppLayoutProps {
  children: React.ReactNode;
}

const roleDisplayNames: Record<UserRole, string> = {
  master: 'Master',
  worker: 'Operator',
  viewer: 'Client',
  superadmin: 'Super Admin',
};

// --- Profile Completion Dialog ---
const profileCompletionSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().optional(),
  phoneNumber: z.string().optional(),
  mobileNumber: z.string().optional(),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  postcode: z.string().min(1, "Postcode is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  vatNumber: z.string().optional(),
  chamberOfCommerce: z.string().optional(),
  eoriNumber: z.string().optional(),
  notes: z.string().optional(),
});

type ProfileCompletionValues = z.infer<typeof profileCompletionSchema>;

const ProfileCompletionDialog = () => {
    const { user, updateUserProfile } = useAuth();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const form = useForm<ProfileCompletionValues>({
        resolver: zodResolver(profileCompletionSchema),
        defaultValues: {
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            companyName: user?.companyName || "",
            phoneNumber: user?.phoneNumber || "",
            mobileNumber: user?.mobileNumber || "",
            addressLine1: user?.addressLine1 || "",
            addressLine2: user?.addressLine2 || "",
            postcode: user?.postcode || "",
            city: user?.city || "",
            country: user?.country || "",
            vatNumber: user?.vatNumber || "",
            chamberOfCommerce: user?.chamberOfCommerce || "",
            eoriNumber: user?.eoriNumber || "",
            notes: user?.notes || "",
        }
    });

    React.useEffect(() => {
        if (user && user.role === 'viewer' && !user.profileComplete) {
            setIsOpen(true);
        }
    }, [user]);

    const onSubmit = async (values: ProfileCompletionValues) => {
        if (!user) return;
        setIsSaving(true);
        try {
            await updateUserProfile({ ...values, profileComplete: true });
            toast({ title: "Profile Complete", description: "Your details have been saved. Welcome!" });
            setIsOpen(false);
        } catch (error) {
            toast({ title: "Error", description: "Could not save your details.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen}>
            <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()} hideCloseButton>
                <DialogHeader>
                    <DialogTitle>Complete Your Profile</DialogTitle>
                    <DialogDescription>
                        Welcome! Please provide a few more details to complete your account setup. This is required for placing orders.
                    </DialogDescription>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                         <FormField control={form.control} name="companyName" render={({ field }) => (<FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="phoneNumber" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="mobileNumber" render={({ field }) => (<FormItem><FormLabel>Mobile Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={form.control} name="addressLine1" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} placeholder="Street and number" /></FormControl><FormMessage /></FormItem>)} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="postcode" render={({ field }) => (<FormItem><FormLabel>Postcode</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="city" render={({ field }) => (<FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                         <FormField control={form.control} name="country" render={({ field }) => (<FormItem><FormLabel>Country</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                         
                         <Separator className="my-4"/>
                         <h4 className="font-semibold text-foreground">Business Details (Optional)</h4>

                         <FormField control={form.control} name="chamberOfCommerce" render={({ field }) => (<FormItem><FormLabel>Chamber of Commerce</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                         <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="vatNumber" render={({ field }) => (<FormItem><FormLabel>VAT Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="eoriNumber" render={({ field }) => (<FormItem><FormLabel>EORI Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                         </div>
                         <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />

                        <DialogFooter className="pt-4 border-t">
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Save and Continue
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};


export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter(); 
  const { 
      user, logout, cartCount, clientPendingOrdersCount, operatorPendingOrdersCount, unreadNotificationsCount, 
      displayBranding, activeDistributor, isImpersonating, stopImpersonating, theme, setTheme,
      accessibleDistributors, activeDistributorId, setActiveDistributorId, setOpenMobile: setSidebarOpen 
  } = useAuth();
  const isMobile = useIsMobile();
  const [defaultOpen, setDefaultOpen] = React.useState(!isMobile); 

  const companyName = displayBranding?.companyName ?? "Vinylogix";
  const logoUrl = displayBranding?.logoUrl ?? "/logo.png";
  
  const clientMenuSettings = activeDistributor?.clientMenuSettings || {
      showCollection: true, showWishlist: true, showScan: true, showDiscogs: true
  };

  const getInitials = (email?: string | null) => {
    if (!email) return "TU";
    return email.substring(0, 2).toUpperCase();
  };

  const navItems = [
    // Superadmin
    { href: '/admin/dashboard', label: 'Distributors', title: 'Platform Dashboard', icon: Building, roles: ['superadmin']},
    { href: '/admin/accounts', label: 'All Users', title: 'User Management', icon: Users, roles: ['superadmin']},
    { href: '/admin/statistics', label: 'Platform Stats', title: 'Platform Statistics', icon: BarChart3, roles: ['superadmin']},
    { href: '/admin/settings', label: 'Platform Settings', title: 'Platform Settings', icon: Shapes, roles: ['superadmin']},
    { href: '/admin/changelog', label: 'Manage Changelog', title: 'Changelog Management', icon: Newspaper, roles: ['superadmin']},
    
    // All Roles
    { href: '/dashboard', label: 'Dashboard', title: 'Dashboard', icon: LayoutDashboard, roles: ['master', 'worker', 'viewer'] },
    
    // Viewer Role (Client) - Ordered as per user request
    { href: '/inventory', label: 'Catalog', title: 'Catalog', icon: Boxes, roles: ['viewer'] },
    { href: '/collection', label: 'My Collection', title: 'My Collection', icon: Library, roles: ['viewer'], setting: clientMenuSettings.showCollection },
    { href: '/favorites', label: 'Favorites', title: 'My Favorites', icon: Heart, roles: ['viewer'] },
    { href: '/wishlist', label: 'My Wishlist', title: 'My Wishlist', icon: ListChecks, roles: ['viewer'], setting: clientMenuSettings.showWishlist },
    { href: '/my-orders', label: 'My Orders', title: 'My Order History', icon: Package, roles: ['viewer'] },
    { href: '/cart', label: 'Cart', title: 'Shopping Cart', icon: ShoppingCart, roles: ['viewer'] },
    { href: '/scan', label: 'Scan/Add Record', title: 'Scan or Add Record', icon: ScanLine, roles: ['viewer'], setting: clientMenuSettings.showScan },
    { href: '/discogs', label: 'Discogs', title: 'Discogs Integration', icon: Disc3, roles: ['viewer'], setting: clientMenuSettings.showDiscogs },
    
    // Operator Roles (Master/Worker)
    { href: '/inventory', label: 'Inventory', title: 'Inventory Management', icon: Boxes, roles: ['master', 'worker'] },
    { href: '/clients', label: 'Clients', title: 'Client Management', icon: Users, roles: ['master']},
    { href: '/operators', label: 'Operators', title: 'Operator Management', icon: HardHat, roles: ['master']},
    { href: '/suppliers', label: 'Suppliers', title: 'Supplier Management', icon: Briefcase, roles: ['master']},
    { href: '/orders', label: 'Orders', title: 'Incoming Orders', icon: ShoppingCart, roles: ['master', 'worker'] },
    { href: '/fulfillment', label: 'Fulfillment', title: 'Order Fulfillment', icon: Truck, roles: ['master', 'worker'] },
    { href: '/notifications', label: 'Notifications', title: 'Notifications', icon: Bell, roles: ['master', 'worker']},
    { href: '/scan', label: 'Scan/Add Record', title: 'Scan or Add Record', icon: ScanLine, roles: ['master', 'worker'] },
    { href: '/discogs', label: 'Discogs', title: 'Discogs Integration', icon: Disc3, roles: ['master'] },
    { href: '/stats', label: 'Statistics', title: 'Distributor Statistics', icon: BarChart3, roles: ['master'] },
    { href: '/import', label: 'Import/Export', title: 'Import / Export Data', icon: FileUp, roles: ['master'] },
    { href: '/inventory/batch-edit', label: 'Batch Edit', title: 'Batch Edit Inventory', icon: FilePenLine, roles: ['master']},
    
    // Public Changelog for all users
    { href: '/changelog', label: 'Changelog', title: 'Changelog', icon: Newspaper, roles: ['master', 'worker', 'viewer'] },

    // Settings for all
    { href: '/settings', label: 'Settings', title: 'Settings', icon: Settings, roles: ['master', 'worker', 'viewer', 'superadmin'] },
  ];
  
  const availableNavItems = navItems.filter(item => {
    if (!user || !item.roles.includes(user.role)) return false;
    if (user.role === 'worker' && item.href === '/orders' && !user.permissions?.canManageOrders) return false;
    if (user.role === 'worker' && item.href === '/fulfillment' && !user.permissions?.canManageOrders) return false;
    if (user.role === 'viewer' && item.setting === false) return false;
    // Hide inventory from viewer menu if it's already shown as catalog
    if (user.role === 'viewer' && item.href === '/inventory' && item.label === 'Inventory') return false; 
    return true;
  });
  
  let currentPageTitle = availableNavItems.find(item => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)))?.title || companyName;
  
  if (user?.role === 'viewer' && pathname.startsWith('/inventory')) {
    currentPageTitle = activeDistributor ? `${activeDistributor.companyName} Catalog` : 'Catalog';
  } else if (user?.role === 'viewer' && !pathname.startsWith('/inventory') && activeDistributor) {
    currentPageTitle = activeDistributor.companyName || companyName;
  }
  
  const handleNavItemClick = () => {
    if (isMobile && setSidebarOpen) {
      setSidebarOpen(false);
    }
  };


  return (
    <SidebarProvider defaultOpen={defaultOpen} onOpenChange={setDefaultOpen}>
      <ProfileCompletionDialog />
      <Sidebar collapsible={isMobile ? "offcanvas" : "icon"}>
        <SidebarHeader className="p-4 flex justify-center items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-xl font-semibold text-sidebar-primary">
            <div className="w-full h-auto group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 transition-all flex items-center justify-center">
              <Image 
                src={logoUrl} 
                alt={`${companyName} Logo`} 
                width={130} 
                height={26} 
                className="group-data-[collapsible=icon]:w-7 group-data-[collapsible=icon]:h-7 h-auto w-auto object-contain" 
                unoptimized={true} 
                onError={(e) => e.currentTarget.src='/logo.png'} 
              />
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent>
            {user?.role === 'viewer' && accessibleDistributors.length > 0 && (
                <div className="p-2">
                    <Select value={activeDistributorId || ""} onValueChange={(value) => setActiveDistributorId(value)}>
                        <SelectTrigger className="group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center">
                            <div className="flex items-center gap-2">
                                <Store className="h-4 w-4" />
                                <SelectValue className="group-data-[collapsible=icon]:hidden" placeholder="Select a store..." />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {accessibleDistributors.map(dist => (
                                <SelectItem key={dist.id} value={dist.id}>{dist.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
          <SidebarMenu>
            {availableNavItems.map((item) => {
              const label = (user?.role === 'viewer' && item.href === '/inventory') ? 'Catalog' : item.label;
              const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

              return (
              <SidebarMenuItem key={item.href} onClick={handleNavItemClick}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={isActive}
                    tooltip={{ children: label, className: "bg-popover text-popover-foreground" }}
                  >
                    <item.icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </Link>
                 {item.href === '/cart' && cartCount > 0 && (
                  <SidebarMenuBadge>{cartCount}</SidebarMenuBadge>
                )}
                {item.href === '/my-orders' && clientPendingOrdersCount > 0 && (
                  <SidebarMenuBadge>{clientPendingOrdersCount}</SidebarMenuBadge>
                )}
                {item.href === '/orders' && operatorPendingOrdersCount > 0 && (
                  <SidebarMenuBadge>{operatorPendingOrdersCount}</SidebarMenuBadge>
                )}
                 {item.href === '/notifications' && unreadNotificationsCount > 0 && (
                  <SidebarMenuBadge>{unreadNotificationsCount}</SidebarMenuBadge>
                )}
                 {(item.href === '/changelog' || item.href === '/admin/changelog') && user?.unreadChangelogs && (
                  <SidebarMenuBadge>New</SidebarMenuBadge>
                 )}
              </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4 group-data-[collapsible=icon]:hidden">
           <SidebarSeparator className="my-1" />
           <div className="flex items-center justify-center gap-2 text-xs text-sidebar-foreground/60 mt-2">
              <Image 
                src="/logo.png" 
                alt="Vinylogix Logo" 
                width={120} 
                height={24}
                className="h-auto w-auto object-contain max-h-[24px]"
                unoptimized={true} 
                onError={(e) => e.currentTarget.src='/logo.png'}
              />
              <span className="font-semibold">v1.0.0</span>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        {isImpersonating && user && (
            <div className="sticky top-0 z-40 flex items-center justify-between bg-yellow-400 px-4 py-2 text-yellow-900 shadow-md">
                <div className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    <p className="font-semibold text-sm">
                        Impersonating: <span className="font-bold">{user.email}</span>
                    </p>
                </div>
                <Button variant="ghost" size="sm" onClick={stopImpersonating} className="text-yellow-900 hover:bg-yellow-500 hover:text-yellow-900">
                    <X className="mr-2 h-4 w-4" />
                    Stop Impersonating
                </Button>
            </div>
        )}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="text-foreground">
              <Menu />
            </SidebarTrigger>
            <h1 className="text-xl font-semibold text-foreground hidden sm:block">
              {currentPageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <GlobalSearch />
            {user && (
              <div className="flex items-center gap-2">
                {user.role !== 'viewer' && user.role !== 'superadmin' && (
                  <Button variant="ghost" size="icon" className="relative" asChild>
                    <Link href="/notifications">
                        <Bell className="h-5 w-5" />
                        {unreadNotificationsCount > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{unreadNotificationsCount}</Badge>}
                        <span className="sr-only">Notifications</span>
                    </Link>
                  </Button>
                )}
                {user.role === 'viewer' && (
                  <Button variant="ghost" size="icon" className="relative" asChild>
                    <Link href="/cart">
                        <ShoppingCart className="h-5 w-5" />
                        {cartCount > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center p-0">{cartCount}</Badge>}
                        <span className="sr-only">Shopping Cart</span>
                    </Link>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={`https://placehold.co/100x100.png?text=${getInitials(user.email)}`} alt={user.email || 'User'} data-ai-hint="avatar user" />
                        <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none text-foreground">{user.email}</p>
                        <p className="text-xs leading-none text-muted-foreground capitalize">{roleDisplayNames[user.role]} Account</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Palette className="mr-2 h-4 w-4" />
                        <span>Theme</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'black')}>
                            <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="black">Black</DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                     {user.role === 'master' && (
                      <DropdownMenuItem onClick={() => router.push('/subscription')}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        <span>Subscription</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => router.push('/settings')}>
                      <Settings2 className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-x-hidden">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

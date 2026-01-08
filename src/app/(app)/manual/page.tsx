"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, LayoutDashboard, ScanLine, BarChart3, Package, ShoppingCart,
  Users, Settings, Library, ListChecks, Heart, Bell, Boxes, Disc3,
  Truck, CreditCard, Building, Palette, Rocket, HelpCircle
} from "lucide-react";

interface ManualSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
  content: {
    title: string;
    text: string;
  }[];
}

const manualSections: ManualSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Rocket,
    badge: "Start Here",
    description: "Quick start guide to get you up and running with Vinylogix.",
    content: [
      {
        title: "Welcome to Vinylogix",
        text: "Vinylogix is your all-in-one platform for managing vinyl record inventory, processing orders, and connecting with clients. Whether you're a distributor managing thousands of records or a collector tracking your personal collection, Vinylogix has the tools you need."
      },
      {
        title: "First Steps",
        text: "1. Complete your profile in Settings\n2. Connect your payment provider (Stripe or PayPal) to accept payments\n3. Add your first records via Scan/Add Record\n4. Invite clients to browse your catalog\n5. Start processing orders!"
      },
      {
        title: "User Roles",
        text: "Master: Full access to all features, can manage workers and settings.\nWorker: Staff access with customizable permissions set by the Master.\nViewer/Client: Can browse catalogs, manage wishlists, and place orders."
      }
    ]
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    description: "Your central hub for quick insights and recent activity.",
    content: [
      {
        title: "Overview",
        text: "The Dashboard provides a quick snapshot of your business. View recent orders, inventory stats, and important notifications at a glance."
      },
      {
        title: "Key Metrics",
        text: "Track your total inventory count, inventory value, recent sales, and pending orders. The dashboard updates in real-time as you process orders and add inventory."
      },
      {
        title: "Quick Actions",
        text: "Access frequently used functions directly from the dashboard, including adding new records, viewing pending orders, and checking notifications."
      }
    ]
  },
  {
    id: "scan-add",
    title: "Scan / Add Record",
    icon: ScanLine,
    description: "Add records to your inventory using barcode scanning or manual entry.",
    content: [
      {
        title: "Barcode Scanning",
        text: "Use your device's camera or a dedicated barcode scanner to quickly add records. Point at the barcode on the record sleeve and Vinylogix will automatically fetch the record details from Discogs."
      },
      {
        title: "Manual Entry",
        text: "Can't scan? No problem. Enter the catalog number, artist, or title manually to search for records. You can also create completely custom entries for rare or unlisted items."
      },
      {
        title: "Handheld Scanner Mode",
        text: "For high-volume entry, enable Handheld Scanner Mode. This optimizes the workflow for USB or Bluetooth barcode scanners, allowing rapid-fire scanning with automatic form submission."
      },
      {
        title: "AI Content Generation",
        text: "Let AI help you create engaging descriptions for your records. The AI can generate artist bios, album summaries, and condition descriptions to make your listings more appealing."
      }
    ]
  },
  {
    id: "inventory",
    title: "Inventory",
    icon: Boxes,
    description: "View, edit, and manage all your vinyl records.",
    content: [
      {
        title: "Inventory List",
        text: "Browse all your records in a searchable, filterable list. Sort by artist, title, price, condition, or date added. Use filters to quickly find specific records."
      },
      {
        title: "Stock Locations",
        text: "Track inventory across multiple locations - shop floor and backroom storage. Know exactly where each record is and manage stock levels for each location."
      },
      {
        title: "Bulk Actions",
        text: "Select multiple records to perform bulk actions: update prices, change locations, adjust stock levels, or export to CSV for external use."
      },
      {
        title: "Record Details",
        text: "Click any record to view full details including tracklist, condition notes, purchase history, and sales performance. Edit any field directly from this view."
      }
    ]
  },
  {
    id: "orders",
    title: "Orders",
    icon: ShoppingCart,
    description: "Process and manage customer orders.",
    content: [
      {
        title: "Order List",
        text: "View all orders with their current status: Pending, Processing, Shipped, or Completed. Filter by status, date range, or customer to find specific orders."
      },
      {
        title: "Processing Orders",
        text: "Click an order to view details, update status, add tracking information, or communicate with the customer. Mark items as packed and generate shipping labels."
      },
      {
        title: "Order Statuses",
        text: "Pending: Payment received, awaiting processing.\nProcessing: Order is being prepared.\nShipped: Package is in transit.\nCompleted: Order delivered successfully.\nCancelled: Order was cancelled."
      },
      {
        title: "Refunds",
        text: "Process refunds directly through the platform. Partial or full refunds are supported, and inventory is automatically restored when orders are cancelled."
      }
    ]
  },
  {
    id: "clients",
    title: "Clients",
    icon: Users,
    description: "Manage your customer relationships and invitations.",
    content: [
      {
        title: "Client List",
        text: "View all your clients with their contact information, order history, and account status. See which clients are most active and valuable."
      },
      {
        title: "Inviting Clients",
        text: "Invite new clients via email. They'll receive an invitation to create an account and access your catalog. You control who can see your inventory and prices."
      },
      {
        title: "Client Permissions",
        text: "Set what each client can see and do. Control access to specific inventory categories, price tiers, and features like wishlists."
      }
    ]
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: BarChart3,
    description: "Track performance with detailed reports and insights.",
    content: [
      {
        title: "Sales Analytics",
        text: "Track revenue over time, identify best-selling records, and analyze sales trends. See which genres and artists perform best."
      },
      {
        title: "Inventory Reports",
        text: "Monitor inventory value, turnover rates, and aging stock. Identify slow-moving items that might need price adjustments."
      },
      {
        title: "Client Insights",
        text: "Understand your customer base: purchase patterns, average order values, and client retention. Use this data to tailor your offerings."
      }
    ]
  },
  {
    id: "collection",
    title: "My Collection",
    icon: Library,
    badge: "Collectors",
    description: "Personal collection management for vinyl enthusiasts.",
    content: [
      {
        title: "Building Your Collection",
        text: "Add records to your personal collection separate from any store inventory. Track what you own, when you got it, and what you paid."
      },
      {
        title: "Collection Value",
        text: "See the total estimated value of your collection based on current market prices. Track how your collection value changes over time."
      },
      {
        title: "Organizing",
        text: "Categorize records by genre, artist, decade, or custom tags. Create playlists or listening queues from your collection."
      }
    ]
  },
  {
    id: "wishlist",
    title: "My Wishlist",
    icon: ListChecks,
    badge: "Collectors",
    description: "Track records you want to acquire.",
    content: [
      {
        title: "Adding to Wishlist",
        text: "Search for any record and add it to your wishlist. Set priority levels and notes for why you want each item."
      },
      {
        title: "Availability Alerts",
        text: "When a record on your wishlist becomes available in a connected distributor's catalog, you'll be notified so you can purchase it."
      }
    ]
  },
  {
    id: "favorites",
    title: "Favorites",
    icon: Heart,
    badge: "Collectors",
    description: "Bookmark records from catalogs for later.",
    content: [
      {
        title: "Saving Favorites",
        text: "While browsing a distributor's catalog, click the heart icon to save records to your favorites for easy access later."
      },
      {
        title: "Managing Favorites",
        text: "View all your favorited items in one place. Quickly add them to cart or compare prices across different distributors."
      }
    ]
  },
  {
    id: "discogs",
    title: "Discogs Integration",
    icon: Disc3,
    description: "Leverage the Discogs database for record information.",
    content: [
      {
        title: "Data Import",
        text: "When you scan or search for a record, Vinylogix pulls detailed information from Discogs: cover art, tracklist, release year, label, and more."
      },
      {
        title: "Important Note",
        text: "Vinylogix uses Discogs data for catalog information only. Your inventory and pricing are completely separate from any Discogs marketplace listings you may have."
      }
    ]
  },
  {
    id: "shipping",
    title: "Shipping",
    icon: Truck,
    description: "Configure shipping options and rates.",
    content: [
      {
        title: "Shipping Methods",
        text: "Set up different shipping methods with custom rates: standard, express, local pickup, etc. Configure rates by weight, destination, or flat fee."
      },
      {
        title: "Tracking",
        text: "Add tracking numbers to orders and customers will automatically receive updates. Integration with major carriers for real-time tracking."
      }
    ]
  },
  {
    id: "payments",
    title: "Payments",
    icon: CreditCard,
    description: "Payment processing and financial settings.",
    content: [
      {
        title: "Stripe Connect",
        text: "Connect your Stripe account to accept card payments. Funds go directly to your account minus platform fees. Setup takes just 5-10 minutes."
      },
      {
        title: "PayPal",
        text: "Accept PayPal payments from customers worldwide. Connect your PayPal Business account for seamless payment processing."
      },
      {
        title: "Fees",
        text: "Vinylogix charges a 4% platform fee on item sales. Payment processor fees (Stripe/PayPal) are separate and go directly to them. See the FAQ for current rates."
      }
    ]
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    description: "Configure your account and preferences.",
    content: [
      {
        title: "Profile Settings",
        text: "Update your business information, contact details, and account preferences. Upload your logo for branded communications."
      },
      {
        title: "Payment Providers",
        text: "Connect or manage your Stripe and PayPal accounts. View connection status and update settings."
      },
      {
        title: "Notifications",
        text: "Configure which notifications you receive: new orders, low stock alerts, client activity, and more. Choose email, push, or in-app notifications."
      },
      {
        title: "Theme",
        text: "Switch between Light, Dark, and Black themes to match your preference. Theme settings are saved to your account."
      }
    ]
  },
  {
    id: "branding",
    title: "Branding",
    icon: Palette,
    badge: "Master",
    description: "Customize the look and feel for your clients.",
    content: [
      {
        title: "Custom Branding",
        text: "Upload your logo and set your company name. Clients will see your branding when they access your catalog."
      },
      {
        title: "Client Experience",
        text: "Control what clients see: enable or disable features like collection management, wishlist, and Discogs integration for your client portal."
      }
    ]
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    description: "Stay updated with real-time alerts.",
    content: [
      {
        title: "Notification Center",
        text: "The bell icon in the header shows your unread notifications. Click to see all recent activity: new orders, client activity, system updates."
      },
      {
        title: "Notification Types",
        text: "Order notifications: New orders, status changes, refund requests.\nInventory alerts: Low stock warnings, price changes.\nClient activity: New registrations, wishlist additions.\nSystem: Updates, maintenance notices."
      }
    ]
  }
];

export default function ManualPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSections = manualSections.filter(section => {
    const searchLower = searchTerm.toLowerCase();
    return (
      section.title.toLowerCase().includes(searchLower) ||
      section.description.toLowerCase().includes(searchLower) ||
      section.content.some(
        c => c.title.toLowerCase().includes(searchLower) || c.text.toLowerCase().includes(searchLower)
      )
    );
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">User Manual</h1>
        <p className="text-muted-foreground mt-2">
          Learn how to use Vinylogix effectively. Find guides for every feature and function.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search the manual..."
          className="pl-10 h-12"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Quick Links */}
      {!searchTerm && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-2">
            {manualSections.slice(0, 6).map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm transition-colors"
              >
                <section.icon className="h-4 w-4" />
                {section.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Manual Sections */}
      <div className="space-y-6">
        {filteredSections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground">
                Try different keywords or browse the sections below.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredSections.map((section) => (
            <Card key={section.id} id={section.id} className="scroll-mt-20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{section.title}</CardTitle>
                      {section.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {section.badge}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {section.content.map((item, index) => (
                    <AccordionItem key={index} value={`${section.id}-${index}`}>
                      <AccordionTrigger className="text-left hover:no-underline">
                        {item.title}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground whitespace-pre-line">
                        {item.text}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Footer Help */}
      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>Can't find what you're looking for?</p>
        <p className="mt-1">
          Visit our{" "}
          <a href="/help" className="text-primary hover:underline">
            Help Center
          </a>{" "}
          or{" "}
          <a href="/contact" className="text-primary hover:underline">
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}

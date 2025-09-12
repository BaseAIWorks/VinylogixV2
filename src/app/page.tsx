
"use client";

import { Button } from "@/components/ui/button";
import { HeroSection } from "@/components/ui/hero-section-1";
import { ArrowRight, ScanLine, Keyboard, Disc3, Bot, Warehouse, ShoppingCart, Users, KeyRound, HardHat, BarChart3, Palette, Building, Package, User, Heart, Library, ListChecks, Laptop, Tablet, Smartphone, Instagram, Facebook, Twitter, Linkedin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

// FeatureShowcase component definition
const FeatureShowcase = ({ title, description, image, imageAlt, features, reverse = false }: { title: string, description: string, image: string, imageAlt: string, features: {icon: React.ElementType, title: string, description: string}[], reverse?: boolean }) => (
    <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4">
            <div className={`grid md:grid-cols-2 items-center gap-12 ${reverse ? 'md:grid-flow-col-dense' : ''}`}>
                <div className={reverse ? 'md:col-start-2' : ''}>
                    <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{title}</h2>
                    <p className="mt-4 text-lg text-muted-foreground">{description}</p>
                    <div className="mt-8 space-y-6">
                        {features.map((feature, index) => (
                            <FeatureListItem key={index} {...feature} />
                        ))}
                    </div>
                </div>
                <div className={`mt-10 md:mt-0 ${reverse ? 'md:col-start-1' : ''}`}>
                    <Image
                        src={image}
                        alt={imageAlt}
                        width={600}
                        height={450}
                        className="rounded-xl shadow-2xl ring-1 ring-black/10 w-full"
                        data-ai-hint={imageAlt}
                    />
                </div>
            </div>
        </div>
    </section>
);

// FeatureListItem component definition
const FeatureListItem = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <div className="flex items-start gap-4">
        <div className="bg-primary/10 text-primary p-3 rounded-full flex-shrink-0 mt-1">
            <Icon className="h-6 w-6" />
        </div>
        <div>
            <h4 className="text-lg font-semibold text-foreground">{title}</h4>
            <p className="text-muted-foreground">{description}</p>
        </div>
    </div>
);

// DeviceSection components definition
const DeviceCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <div className="p-6">
        <div className="flex justify-center mb-4">
            <div className="bg-background p-4 rounded-full border shadow-sm">
                <Icon className="h-10 w-10 text-primary" />
            </div>
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
    </div>
);

const DeviceSection = () => (
    <section className="py-16 sm:py-24 bg-primary/5 dark:bg-primary/10">
        <div className="container mx-auto px-4">
            <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">Works Where You Work</h2>
                <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                    From the counter to the stockroom and beyond, Vinylogix is designed for every part of your business.
                </p>
            </div>
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                <DeviceCard icon={Laptop} title="Desktop" description="The command center for your business. Dive deep into analytics, manage users, and perform bulk inventory updates with a full-featured interface." />
                <DeviceCard icon={Tablet} title="Tablet" description="Untether from the counter. Use your tablet as a mobile point-of-sale, a digital catalog for customers, or for quick stock adjustments right in the aisle." />
                <DeviceCard icon={Smartphone} title="Mobile" description="Your business in your pocket. Scan barcodes on the go, check order statuses from anywhere, and never miss an important update." />
            </div>
        </div>
    </section>
);


// CTA Section component definition
const CallToActionSection = () => (
  <section className="bg-background py-24">
      <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-primary">Ready to Transform Your Workflow?</h2>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
              Stop juggling spreadsheets and start using a tool built for the love of vinyl.
          </p>
          <div className="mt-8">
              <Button size="lg" asChild>
                  <Link href="/register/client">
                      Get Started for Free <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
              </Button>
          </div>
      </div>
  </section>
);

// Footer component definition
const PageFooter = () => {
    const footerLinks = {
        Product: [
            { href: "/features", text: "Features" },
            { href: "/pricing", text: "Pricing" },
            { href: "/#", text: "Changelog" },
        ],
        Company: [
            { href: "/#", text: "About" },
            { href: "/#", text: "Team" },
            { href: "/#", text: "Blog" },
        ],
        Resources: [
            { href: "/#", text: "Contact" },
            { href: "/#", text: "Support" },
            { href: "/#", text: "Privacy" },
        ],
    };

    return (
        <footer className="border-t bg-background">
            <div className="container mx-auto max-w-7xl px-4 py-12">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
                <div className="lg:col-span-1">
                    <div className="flex items-center gap-2">
                        <Image src="/logo.png" alt="Vinylogix Logo" width={150} height={30} className="h-auto w-auto max-h-[30px]" unoptimized={true} />
                    </div>
                    <p className="mt-4 max-w-xs text-muted-foreground">
                    The ultimate platform for vinyl record stores and collectors to manage their inventory and passion.
                    </p>
                    <div className="mt-6 flex gap-4">
                    <a href="/#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Instagram"><Instagram className="h-6 w-6" /></a>
                    <a href="/#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Facebook"><Facebook className="h-6 w-6" /></a>
                    <a href="/#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Twitter"><Twitter className="h-6 w-6" /></a>
                    <a href="/#" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="LinkedIn"><Linkedin className="h-6 w-6" /></a>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 lg:col-span-3 sm:grid-cols-3">
                    {Object.entries(footerLinks).map(([title, links]) => (
                        <div key={title}>
                        <p className="font-semibold text-foreground">{title}</p>
                        <nav className="mt-4 flex flex-col space-y-2 text-sm text-muted-foreground">
                            {links.map((link) => (
                                <Link key={link.href + link.text} href={link.href} className="hover:text-foreground">{link.text}</Link>
                            ))}
                        </nav>
                        </div>
                    ))}
                </div>
                </div>
                
                <div className="mt-12 border-t pt-8">
                <div className="flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
                    <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} Vinylogix. All rights reserved.</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                        <Link href="/#" className="hover:text-foreground">Terms & Conditions</Link>
                        <Link href="/#" className="hover:text-foreground">Privacy Policy</Link>
                    </div>
                </div>
                </div>
            </div>
        </footer>
    );
};


export default function MarketingPage() {
    
    // Feature data
    const inventoryFeatures = [
        { icon: ScanLine, title: "Instant Barcode Scanning", description: "Quickly add or find records with your device's camera, eliminating tedious manual entry." },
        { icon: Keyboard, title: "Handheld Scanner Support", description: "Optimized workflow for dedicated USB or Bluetooth barcode scanners, enabling rapid-fire inventory processing." },
        { icon: Disc3, title: "Automatic Discogs Sync", description: "Pull rich data like tracklists, genres, and cover art automatically, saving you hours of work." },
        { icon: Bot, title: "AI-Powered Content", description: "Generate engaging artist bios and album summaries to enrich your catalog with minimal effort." },
        { icon: Warehouse, title: "Dual Stock Locations", description: "Track inventory for both your shop floor and backroom storage with separate counters and locations." },
    ];

    const managementFeatures = [
        { icon: ShoppingCart, title: "Integrated Order Management", description: "A seamless shopping cart and checkout experience for your clients, with a clear dashboard for you to manage orders." },
        { icon: HardHat, title: "Role-Based Access Control", description: "Assign 'Master' or 'Worker' roles to staff, with fine-tuned permissions for viewing prices, managing orders, and more." },
        { icon: BarChart3, title: "Insightful Analytics", description: "Track sales performance, inventory valuation, and identify your most profitable and top-selling records." },
        { icon: Building, title: "Multi-Distributor Platform", description: "The architecture is built to support multiple independent distributors, all managed by a central super-admin." },
    ];
    
    const collectorFeatures = [
        { icon: Library, title: "Personal Collection", description: "Catalog your own vinyl records, separate from any store inventory, with all the same rich details." },
        { icon: ListChecks, title: "Universal Wishlist", description: "Keep track of records you want. If an item on your wishlist becomes available in the catalog, you'll know." },
        { icon: Heart, title: "Favorites", description: "Easily bookmark records from a distributor's catalog that you're interested in for quick access later." },
        { icon: Package, title: "Seamless Ordering", description: "Purchase directly from your local record store's catalog with an integrated cart and checkout process." },
    ];


  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
        <HeroSection />

        <main>
            <FeatureShowcase 
                title="Inventory Management Redefined"
                description="Go beyond spreadsheets. From barcode scanning to AI-powered descriptions, manage your stock with precision and ease."
                image="/Invent-app.png"
                imageAlt="record store inventory"
                features={inventoryFeatures}
            />

            <FeatureShowcase 
                title="Insightful Analytics & Client Management"
                description="Get a 360-degree view of your operation. Control user access, manage clients, and make data-driven decisions."
                image="/Statis-app.png"
                imageAlt="business analytics"
                features={managementFeatures}
                reverse={true}
            />
            
            <FeatureShowcase 
                title="The Ultimate Collector's Companion"
                description="Vinylogix isn't just for sellers. We provide powerful tools for collectors to manage their passion and discover new music."
                image="/Client-app.png"
                imageAlt="personal collection view"
                features={collectorFeatures}
            />
            
            <DeviceSection />
            
            <CallToActionSection />
        </main>

        <PageFooter />
    </div>
  );
}

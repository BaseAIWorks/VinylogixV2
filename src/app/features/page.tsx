
"use client";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Check, Disc3, BarChart3, ScanLine, ShoppingCart, HardHat, Package, Users, Bot, Building, KeyRound, Palette, Settings, Warehouse, Keyboard, Laptop, Tablet, Smartphone, Instagram, Facebook, Twitter, Linkedin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

// New component for a single feature highlight with an icon
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

// New component for a feature section with image
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


export default function FeaturesPage() {
    const { user } = useAuth();
    const router = useRouter();

    const inventoryFeatures = [
        { icon: ScanLine, title: "Instant Barcode Scanning", description: "Quickly add or find records with your device's camera, eliminating tedious manual entry." },
        { icon: Keyboard, title: "Handheld Scanner Support", description: "Optimized workflow for dedicated USB or Bluetooth barcode scanners, enabling rapid-fire inventory processing." },
        { icon: Disc3, title: "Automatic Discogs Sync", description: "Pull rich data like tracklists, genres, and cover art automatically, saving you hours of work." },
        { icon: Bot, title: "AI-Powered Content", description: "Generate engaging artist bios and album summaries to enrich your catalog with minimal effort." },
        { icon: Warehouse, title: "Dual Stock Locations", description: "Track inventory for both your shop floor and backroom storage with separate counters and locations." },
    ];

    const salesFeatures = [
        { icon: ShoppingCart, title: "Integrated Order Management", description: "A seamless shopping cart and checkout experience for your clients, with a clear dashboard for you to manage orders." },
        { icon: Users, title: "Client Wishlist Insights", description: "See exactly what your customers are looking for, giving you valuable data to inform purchasing decisions." },
        { icon: KeyRound, title: "Professional Order Numbering", description: "Automated, sequential order numbers (e.g., 'ABC-00001') provide a professional touch and easy tracking." },
    ];
    
     const managementFeatures = [
        { icon: HardHat, title: "Role-Based Access Control", description: "Assign 'Master' or 'Worker' roles to staff, with fine-tuned permissions for viewing prices, managing orders, and more." },
        { icon: BarChart3, title: "Insightful Analytics", description: "Track sales performance, inventory valuation, and identify your most profitable and top-selling records." },
        { icon: Palette, title: "Customizable Branding", description: "Apply your own company name and logo to create a branded experience for your staff and clients." },
        { icon: Building, title: "Multi-Distributor Platform", description: "The architecture is built to support multiple independent distributors, all managed by a central super-admin." },
    ];

    const multiDeviceFeatures = [
        { icon: Laptop, title: "Desktop Power", description: "The command center for your business. Dive deep into analytics, manage users, and perform bulk inventory updates with a full-featured interface." },
        { icon: Tablet, title: "Tablet Flexibility", description: "Untether from the counter. Use your tablet as a mobile point-of-sale, a digital catalog for customers, or for quick stock adjustments right in the aisle." },
        { icon: Smartphone, title: "Mobile Efficiency", description: "Your business in your pocket. Scan barcodes on the go, check order statuses from anywhere, and never miss an important update." },
    ];


    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm">
            <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
               <Link href="/" className="flex items-center gap-2">
                <Image src="/logo.png" alt="Vinylogix Logo" width={180} height={36} className="h-auto w-auto max-h-[36px]" unoptimized={true} />
              </Link>
              <div className="hidden items-center gap-4 md:flex">
                 <Button variant="ghost" onClick={() => router.push('/features')}>Features</Button>
                 <Button variant="ghost" onClick={() => router.push('/pricing')}>Pricing</Button>
              </div>
              <div className="flex items-center gap-2">
                {user ? (
                  <Button onClick={() => router.push('/dashboard')}>Login</Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => router.push('/login')}>Log In</Button>
                    <Button onClick={() => router.push('/register')}>Sign Up</Button>
                  </>
                )}
              </div>
            </div>
        </header>

        <main className="flex-grow">
            {/* Hero Section */}
            <section className="relative overflow-hidden py-24 md:py-32">
                <div className="container mx-auto px-4 text-center">
                    <div className="absolute -z-10 -top-1/4 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(ellipse_40%_50%_at_50%_30%,hsl(var(--primary)/0.15),transparent)]"></div>
                    <h1 className="text-5xl font-extrabold tracking-tight text-primary sm:text-6xl">A Feature for Every Spin</h1>
                    <p className="mt-6 max-w-3xl mx-auto text-xl text-muted-foreground">
                        Vinylogix is more than just an inventory tool. It's a complete ecosystem designed to streamline your workflow, engage your customers, and grow your business.
                    </p>
                </div>
            </section>
            
            {/* Feature Showcases */}
            <FeatureShowcase 
                title="Inventory Management Redefined"
                description="Go beyond spreadsheets. From barcode scanning to AI-powered descriptions, manage your stock with precision and ease."
                image="https://placehold.co/600x450.png"
                imageAlt="record store inventory"
                features={inventoryFeatures}
            />

             <FeatureShowcase 
                title="Effortless Sales & Client Engagement"
                description="Empower your customers with a clean, searchable catalog and gain valuable insights into what they truly want."
                image="https://placehold.co/600x450.png"
                imageAlt="online music store"
                features={salesFeatures}
                reverse={true}
            />
            
            <FeatureShowcase 
                title="Powerful Management & Analytics"
                description="Get a 360-degree view of your operation. Control user access, customize branding, and make data-driven decisions."
                image="https://placehold.co/600x450.png"
                imageAlt="business analytics"
                features={managementFeatures}
            />
            
            <FeatureShowcase 
                title="Seamless Across All Your Devices"
                description="Whether you're at your desk, on the shop floor, or at a trade fair, Vinylogix provides a consistent and powerful experience on any screen."
                image="/Devices_invent.png"
                imageAlt="responsive design devices"
                features={multiDeviceFeatures}
                reverse={true}
            />
            
            {/* Call to Action Section */}
            <section className="bg-primary/5 dark:bg-primary/10 mt-16 py-24">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-4xl font-bold text-primary">Ready to Transform Your Workflow?</h2>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
                        Stop juggling spreadsheets and start using a tool built for the love of vinyl.
                    </p>
                    <div className="mt-8">
                        <Button size="lg" asChild>
                            <Link href="/register">
                                Get Started for Free <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>
        </main>

        <PageFooter />
      </div>
    );
}

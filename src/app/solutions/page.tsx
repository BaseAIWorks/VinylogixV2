'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Package,
  ListChecks,
  Truck,
  Bell,
  ShoppingCart,
  CreditCard,
  Library,
  Globe,
  Shield,
  RefreshCw,
  Receipt,
  Banknote,
  DollarSign,
  TrendingUp,
  Award,
  PieChart,
  ScanLine,
  Disc3,
  Bot,
  Warehouse,
  HardHat,
  Palette,
  Check,
  Sparkles,
  Settings,
  LogOut,
  LayoutDashboard,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Footer } from '@/components/landing/Footer';
import type { UserRole } from '@/types';

const roleDisplayNames: Record<UserRole, string> = {
  master: 'Master',
  worker: 'Operator',
  viewer: 'Client',
  superadmin: 'Super Admin',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SolutionsPage() {
  return (
    <div className="relative min-h-screen">
      {/* Global flowing background */}
      <div className="fixed inset-0 -z-50">
        <div className="absolute inset-0 bg-background" />
        <motion.div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.15), transparent),
              radial-gradient(ellipse 60% 40% at 80% 50%, rgba(59,130,246,0.08), transparent),
              radial-gradient(ellipse 60% 40% at 20% 80%, rgba(124,58,237,0.08), transparent)
            `,
          }}
        />
      </div>

      <Header />

      <main className="relative">
        <SolutionsHero />
        <OrderManagementSection />
        <ECommerceSection />
        <PaymentsSection />
        <AnalyticsSection />
        <AdditionalFeaturesSection />
        <FinalCTASection />
      </main>

      <Footer />
    </div>
  );
}

// ============================================================================
// HEADER
// ============================================================================

const menuItems = [
  { name: 'Solutions', href: '/solutions' },
  { name: 'Pricing', href: '/pricing' },
];

function Header() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = React.useState(false);

  const getInitials = (email?: string | null) => {
    if (!email) return 'TU';
    return email.substring(0, 2).toUpperCase();
  };

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : user?.email;

  React.useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className="fixed z-50 w-full">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className={cn(
            'mt-4 rounded-2xl px-4 py-3 transition-all duration-300',
            isScrolled
              ? 'bg-background/80 backdrop-blur-xl border border-border/50 shadow-lg'
              : 'bg-transparent'
          )}
        >
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="Vinylogix"
                width={140}
                height={32}
                className="h-8 w-auto"
                unoptimized
                priority
              />
            </Link>

            <div className="hidden md:flex items-center gap-8">
              {menuItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <span className="hidden sm:inline">{displayName}</span>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{getInitials(user.email)}</AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push('/settings')}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/register/client">Get Started</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

// ============================================================================
// SOLUTIONS HERO
// ============================================================================

function SolutionsHero() {
  return (
    <section className="pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Solutions for Vinyl Businesses</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground"
          >
            Everything You Need to{' '}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer">
              Run Your Store
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            From order management to payment processing to analytics, Vinylogix provides
            the complete toolkit for vinyl record stores and distributors.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button asChild size="lg" className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20">
              <Link href="/register">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-6 rounded-xl">
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// SOLUTION SECTION COMPONENT
// ============================================================================

interface SolutionFeature {
  icon: React.ElementType;
  title: string;
  description: string;
}

interface SolutionSectionProps {
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  features: SolutionFeature[];
  imageSrc?: string;
  imageAlt?: string;
  reverse?: boolean;
  accentColor?: 'primary' | 'accent' | 'emerald' | 'blue';
}

function SolutionSection({
  badge,
  title,
  subtitle,
  description,
  features,
  imageSrc,
  imageAlt,
  reverse = false,
  accentColor = 'primary',
}: SolutionSectionProps) {
  const colorClasses = {
    primary: {
      badge: 'text-primary',
      icon: 'bg-primary/10 text-primary group-hover:bg-primary/20',
      gradient: 'from-primary to-accent',
    },
    accent: {
      badge: 'text-accent',
      icon: 'bg-accent/10 text-accent group-hover:bg-accent/20',
      gradient: 'from-accent to-primary',
    },
    emerald: {
      badge: 'text-emerald-500',
      icon: 'bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20',
      gradient: 'from-emerald-500 to-teal-500',
    },
    blue: {
      badge: 'text-blue-500',
      icon: 'bg-blue-500/10 text-blue-500 group-hover:bg-blue-500/20',
      gradient: 'from-blue-500 to-indigo-500',
    },
  };

  const colors = colorClasses[accentColor];

  return (
    <section className="py-16 sm:py-24 border-t border-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div
          className={cn(
            'grid lg:grid-cols-2 gap-12 items-center',
            reverse && 'lg:grid-flow-col-dense'
          )}
        >
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: reverse ? 30 : -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6 }}
            className={cn(reverse && 'lg:col-start-2')}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full border border-border/50 bg-card/50"
            >
              <span className={cn('text-sm font-medium', colors.badge)}>{badge}</span>
            </motion.div>

            {/* Title */}
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
              {title}
            </h2>
            <p
              className={cn(
                'text-xl font-semibold mb-4 bg-gradient-to-r bg-clip-text text-transparent',
                colors.gradient
              )}
            >
              {subtitle}
            </p>

            <p className="text-muted-foreground mb-8 max-w-lg">{description}</p>

            {/* Features grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + index * 0.05 }}
                    className="group flex items-start gap-3"
                  >
                    <div
                      className={cn(
                        'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                        colors.icon
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Image placeholder */}
          <motion.div
            initial={{ opacity: 0, x: reverse ? -30 : 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className={cn('relative', reverse && 'lg:col-start-1')}
          >
            <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-card/30 p-4">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={imageAlt || 'Feature showcase'}
                  className="w-full rounded-xl"
                />
              ) : (
                <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-card to-background flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-primary/10 flex items-center justify-center">
                      {features[0] && (() => {
                        const FirstIcon = features[0].icon;
                        return <FirstIcon className="w-8 h-8 text-primary" />;
                      })()}
                    </div>
                    <p className="text-sm">{badge}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// ORDER MANAGEMENT SECTION
// ============================================================================

const orderManagementFeatures: SolutionFeature[] = [
  {
    icon: Package,
    title: 'Incoming Orders Dashboard',
    description: 'See all new orders at a glance with real-time updates',
  },
  {
    icon: ListChecks,
    title: 'Status Tracking',
    description: 'Pending, Confirmed, Packed, Shipped workflow',
  },
  {
    icon: Truck,
    title: 'Fulfillment Pipeline',
    description: 'Streamlined pick, pack, ship workflow',
  },
  {
    icon: Bell,
    title: 'Order Notifications',
    description: 'Instant alerts for new orders and updates',
  },
];

function OrderManagementSection() {
  return (
    <SolutionSection
      badge="Order Management"
      title="Streamlined Order Management"
      subtitle="From Incoming to Fulfilled"
      description="Track every order from the moment it's placed to delivery. Our intuitive dashboard keeps you in control of your entire fulfillment process."
      features={orderManagementFeatures}
      imageSrc="/Hero-2.png"
      imageAlt="Order management dashboard"
      accentColor="primary"
    />
  );
}

// ============================================================================
// E-COMMERCE SECTION
// ============================================================================

const eCommerceFeatures: SolutionFeature[] = [
  {
    icon: ShoppingCart,
    title: 'Shopping Cart',
    description: 'Real-time stock updates and seamless checkout',
  },
  {
    icon: CreditCard,
    title: 'Secure Checkout',
    description: 'Multiple payment options for customers',
  },
  {
    icon: Library,
    title: 'Client Catalog',
    description: 'Searchable, filterable inventory for buyers',
  },
  {
    icon: Globe,
    title: 'Custom Storefront URL',
    description: 'Your branded web address for customers',
  },
];

function ECommerceSection() {
  return (
    <SolutionSection
      badge="E-Commerce"
      title="Your Own Online Storefront"
      subtitle="Sell Directly to Collectors"
      description="Give your customers a beautiful, easy-to-use storefront where they can browse your inventory, add to cart, and checkout securely."
      features={eCommerceFeatures}
      imageSrc="/Client-app.png"
      imageAlt="E-commerce storefront"
      reverse
      accentColor="accent"
    />
  );
}

// ============================================================================
// PAYMENTS SECTION
// ============================================================================

const paymentsFeatures: SolutionFeature[] = [
  {
    icon: Shield,
    title: 'Secure Payments',
    description: 'PCI-DSS compliant, all major cards accepted',
  },
  {
    icon: RefreshCw,
    title: 'Automated Transfers',
    description: 'Automatic payouts directly to your bank',
  },
  {
    icon: Receipt,
    title: '4% Platform Fee',
    description: 'Simple, transparent pricing with no hidden costs',
  },
  {
    icon: Banknote,
    title: 'PayPal Integration',
    description: 'Alternative payment option for customers',
  },
];

function PaymentsSection() {
  return (
    <SolutionSection
      badge="Payments"
      title="Secure Payment Processing"
      subtitle="Powered by Stripe Connect"
      description="Accept payments with confidence. Stripe Connect handles all the complexity of payment processing, transfers, and compliance."
      features={paymentsFeatures}
      imageSrc="/Invent-app.png"
      imageAlt="Payment processing"
      accentColor="emerald"
    />
  );
}

// ============================================================================
// ANALYTICS SECTION
// ============================================================================

const analyticsFeatures: SolutionFeature[] = [
  {
    icon: DollarSign,
    title: 'Inventory Valuation',
    description: 'Real-time total stock value calculation',
  },
  {
    icon: TrendingUp,
    title: 'Sales Performance',
    description: 'Revenue and margin tracking over time',
  },
  {
    icon: Award,
    title: 'Top Products',
    description: 'Identify best sellers and most profitable items',
  },
  {
    icon: PieChart,
    title: 'Genre & Format Breakdown',
    description: 'Category analytics for informed purchasing',
  },
];

function AnalyticsSection() {
  return (
    <SolutionSection
      badge="Analytics"
      title="Data-Driven Decisions"
      subtitle="Powerful Analytics Dashboard"
      description="Understand your business with comprehensive analytics. Track what's selling, what's profitable, and where to focus your buying efforts."
      features={analyticsFeatures}
      reverse
      accentColor="blue"
    />
  );
}

// ============================================================================
// ADDITIONAL FEATURES BENTO GRID
// ============================================================================

interface BentoFeature {
  icon: React.ElementType;
  title: string;
  description: string;
  className?: string;
  gradient?: string;
}

const additionalFeatures: BentoFeature[] = [
  {
    icon: ScanLine,
    title: 'Barcode Scanning',
    description: 'Camera + handheld scanner support for rapid inventory processing',
    className: 'md:col-span-2',
    gradient: 'from-primary/20 to-primary/5',
  },
  {
    icon: Disc3,
    title: 'Discogs Integration',
    description: 'Auto-sync metadata and cover art from the world\'s largest music database',
    className: 'md:col-span-1',
    gradient: 'from-accent/20 to-accent/5',
  },
  {
    icon: Bot,
    title: 'AI Content Generation',
    description: 'Generate artist bios and descriptions with Gemini AI',
    className: 'md:col-span-1',
    gradient: 'from-purple-500/20 to-purple-500/5',
  },
  {
    icon: Warehouse,
    title: 'Dual Stock Locations',
    description: 'Separate shop floor and backroom inventory tracking',
    className: 'md:col-span-1',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
  },
  {
    icon: HardHat,
    title: 'Role-Based Access',
    description: 'Master and Worker permissions for team management',
    className: 'md:col-span-1',
    gradient: 'from-orange-500/20 to-orange-500/5',
  },
  {
    icon: Palette,
    title: 'Custom Branding',
    description: 'Your logo and custom storefront URL for brand consistency',
    className: 'md:col-span-2',
    gradient: 'from-blue-500/20 to-blue-500/5',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15,
    },
  },
};

function AdditionalFeaturesSection() {
  return (
    <section className="py-16 sm:py-24 border-t border-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            And So Much More
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Additional features to supercharge your vinyl business operations.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {additionalFeatures.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                variants={itemVariants}
                className={cn(
                  'group relative rounded-xl p-5 overflow-hidden',
                  'border border-border/50 bg-card/30',
                  'hover:border-primary/30 hover:bg-card/50 transition-all duration-300',
                  feature.className
                )}
              >
                {/* Gradient background on hover */}
                <div
                  className={cn(
                    'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                    'bg-gradient-to-br',
                    feature.gradient
                  )}
                />

                {/* Content */}
                <div className="relative z-10">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FINAL CTA SECTION
// ============================================================================

const trustIndicators = [
  { text: '7-day free trial' },
  { text: 'No credit card required' },
  { text: 'Cancel anytime' },
];

function FinalCTASection() {
  return (
    <section className="py-16 sm:py-24 border-t border-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-2xl overflow-hidden"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
          <div className="absolute inset-0 backdrop-blur-3xl" />

          {/* Border glow */}
          <div className="absolute inset-0 rounded-2xl border border-primary/20" />

          {/* Content */}
          <div className="relative px-6 py-12 sm:px-12 sm:py-16 text-center">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl sm:text-4xl font-bold tracking-tight mb-4"
            >
              Ready to Transform Your{' '}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Vinyl Business?
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8"
            >
              Join hundreds of record stores and distributors already using Vinylogix
              to streamline their operations and grow their business.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8"
            >
              <Button asChild size="lg" className="h-12 px-8 rounded-xl shadow-lg shadow-primary/20">
                <Link href="/register">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-8 rounded-xl">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="flex flex-wrap items-center justify-center gap-6"
            >
              {trustIndicators.map((indicator, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary" />
                  <span>{indicator.text}</span>
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

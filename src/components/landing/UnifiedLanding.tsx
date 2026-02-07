'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Logo } from '@/components/ui/logo';
import {
  ArrowRight,
  Gift,
  Disc3,
  Library,
  ListChecks,
  Heart,
  Package,
  Laptop,
  Tablet,
  Smartphone,
  Check,
  Sparkles,
  Store,
  Instagram,
  Facebook,
  Scan,
  Wand2,
  PackageSearch,
  Receipt,
  PieChart,
  Wallet,
  Shield,
  UsersRound,
  Brush,
  Bot,
  Warehouse,
  HardHat,
  CreditCard,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedGroup } from '@/components/ui/animated-group';
import { cn } from '@/lib/utils';
import { Header } from './Header';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function UnifiedLanding() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();

  return (
    <div ref={containerRef} className="relative min-h-screen">
      {/* Global flowing background */}
      <div className="fixed inset-0 -z-50">
        <div className="absolute inset-0 bg-background" />
        <motion.div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 50% -10%, rgba(232,106,51,0.15), transparent),
              radial-gradient(ellipse 60% 40% at 80% 50%, rgba(202,138,4,0.08), transparent),
              radial-gradient(ellipse 60% 40% at 20% 80%, rgba(232,106,51,0.08), transparent)
            `,
          }}
        />
      </div>

      <Header />

      <main className="relative">
        {/* Hero Section */}
        <HeroSection />

        {/* Stats Bar - inline social proof */}
        <StatsBar />

        {/* Features Section */}
        <FeaturesSection />

        {/* Platform Showcase - Distributors & Collectors */}
        <PlatformShowcase />

        {/* Pricing + CTA Combined */}
        <PricingSection />

        {/* Final CTA */}
        <FinalCTASection />
      </main>

      <Footer />
    </div>
  );
}

// ============================================================================
// HERO SECTION
// ============================================================================

function HeroSection() {
  return (
    <section className="pt-32 pb-8 sm:pt-40 sm:pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-sm font-medium text-primary">AI-Powered Vinyl Management</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground"
          >
            The Complete Platform for{' '}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer">
              Vinyl Businesses
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            Inventory management, order processing, and analytics - everything you need
            to run your record store or manage your collection.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Button asChild size="lg" className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20">
              <Link href="/register/client">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 px-6 rounded-xl">
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </motion.div>

          {/* Trial badge */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-sm text-muted-foreground flex items-center justify-center gap-2"
          >
            <Gift className="h-4 w-4 text-primary" />
            7-day free trial with all features
          </motion.p>
        </div>

        {/* Hero Image */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-10 sm:mt-12"
        >
          <div className="relative rounded-xl overflow-hidden border border-border/50 shadow-2xl shadow-primary/10">
            <img
              src="/Hero-2_Trans.png"
              alt="Vinylogix Dashboard"
              className="w-full"
            />
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background to-transparent" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// STATS BAR - Inline social proof
// ============================================================================

const stats = [
  { value: '50K+', label: 'Records Managed' },
  { value: '500+', label: 'Distributors' },
  { value: '10K+', label: 'Collectors' },
  { value: '99%', label: 'Uptime' },
];

function StatsBar() {
  return (
    <section className="py-8 border-y border-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="text-2xl sm:text-3xl font-bold text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FEATURES SECTION - Bento Grid
// ============================================================================

const features = [
  {
    icon: Scan,
    title: 'Barcode Scanning',
    description: 'Camera or hardware scanner for rapid inventory.',
    color: 'bg-orange-500',
  },
  {
    icon: Wand2,
    title: 'AI Content',
    description: 'Auto-generate artist bios and descriptions.',
    color: 'bg-violet-500',
  },
  {
    icon: PackageSearch,
    title: 'Stock Locations',
    description: 'Manage shop floor and backroom separately.',
    color: 'bg-emerald-500',
  },
  {
    icon: Receipt,
    title: 'Order Management',
    description: 'Cart, checkout, and real-time tracking.',
    color: 'bg-sky-500',
  },
  {
    icon: PieChart,
    title: 'Analytics',
    description: 'Sales performance and inventory insights.',
    color: 'bg-pink-500',
  },
  {
    icon: Wallet,
    title: 'Payments',
    description: 'Stripe and PayPal with auto invoicing.',
    color: 'bg-indigo-500',
  },
  {
    icon: Shield,
    title: 'Access Control',
    description: 'Role-based permissions for your team.',
    color: 'bg-amber-500',
  },
  {
    icon: UsersRound,
    title: 'Client Insights',
    description: 'View wishlists and customer favorites.',
    color: 'bg-teal-500',
  },
  {
    icon: Brush,
    title: 'Custom Branding',
    description: 'Your logo and name for a branded look.',
    color: 'bg-rose-500',
  },
];

function FeaturesSection() {
  return (
    <section className="py-10 sm:py-14">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Everything You Need
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful tools to manage inventory, process orders, and grow your business.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04 }}
                className={cn(
                  'group flex items-start gap-3 p-4 rounded-xl',
                  'border border-border/40 bg-card/30 backdrop-blur-sm',
                  'hover:bg-card/60 hover:border-primary/30 hover:shadow-md',
                  'transition-all duration-200'
                )}
              >
                {/* Icon */}
                <div className={cn(
                  'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                  feature.color,
                  'group-hover:scale-105 transition-transform duration-200'
                )}>
                  <Icon className="w-5 h-5 text-white" />
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground leading-tight">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Device support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-10 flex items-center justify-center gap-8 text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <Laptop className="w-5 h-5" />
            <span className="text-sm">Desktop</span>
          </div>
          <div className="flex items-center gap-2">
            <Tablet className="w-5 h-5" />
            <span className="text-sm">Tablet</span>
          </div>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            <span className="text-sm">Mobile</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// PLATFORM SHOWCASE - Distributors & Collectors
// ============================================================================

const distributorFeatures = [
  { icon: Scan, text: 'Barcode scanning (camera + hardware)' },
  { icon: Disc3, text: 'Discogs API integration' },
  { icon: Bot, text: 'AI-powered content generation' },
  { icon: Warehouse, text: 'Dual stock locations' },
  { icon: HardHat, text: 'Role-based access control' },
  { icon: CreditCard, text: 'Stripe & PayPal payments' },
];

const collectorFeatures = [
  { icon: Library, text: 'Personal collection catalog' },
  { icon: ListChecks, text: 'Universal wishlist' },
  { icon: Heart, text: 'Favorites from any store' },
  { icon: Package, text: 'Direct ordering' },
];

function PlatformShowcase() {
  return (
    <section className="py-10 sm:py-14 border-t border-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Built for Everyone
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Whether you run a record store or collect vinyl, we have the tools for you.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Distributors Card */}
          <motion.div
            id="distributors"
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-6 rounded-2xl border border-border/50 bg-card/30 scroll-mt-24"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">For Distributors</h3>
                <p className="text-sm text-muted-foreground">Record stores & sellers</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {distributorFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature.text}</span>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl overflow-hidden border border-border/50">
              <img src="/Invent-app.png" alt="Distributor Dashboard" className="w-full" />
            </div>
          </motion.div>

          {/* Collectors Card */}
          <motion.div
            id="collectors"
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-6 rounded-2xl border border-border/50 bg-card/30 scroll-mt-24"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">For Collectors</h3>
                <p className="text-sm text-muted-foreground">Vinyl enthusiasts</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {collectorFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-accent flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature.text}</span>
                  </div>
                );
              })}
              {/* Spacer to match height */}
              <div className="h-3" />
              <div className="h-3" />
            </div>

            <div className="rounded-xl overflow-hidden border border-border/50">
              <img src="/Client-app.png" alt="Collector Dashboard" className="w-full" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// PRICING SECTION - With CTA
// ============================================================================

const tiers = [
  {
    name: 'Free',
    price: '$0',
    description: 'For collectors',
    features: ['Up to 100 records', 'Personal collection', 'Wishlist', 'Favorites'],
    cta: 'Get Started',
    href: '/register/client',
  },
  {
    name: 'Growth',
    price: '$29',
    period: '/mo',
    description: 'For small stores',
    features: ['Up to 1,000 records', 'Discogs integration', 'Order management', '2 users'],
    cta: 'Start Trial',
    href: '/pricing',
    popular: true,
  },
  {
    name: 'Scale',
    price: '$79',
    period: '/mo',
    description: 'For growing businesses',
    features: ['Unlimited records', 'AI content', 'Advanced analytics', 'Unlimited users'],
    cta: 'Start Trial',
    href: '/pricing',
  },
];

function PricingSection() {
  return (
    <section className="py-10 sm:py-14 border-t border-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Simple Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Start free and upgrade as you grow. All paid plans include a 7-day trial.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'relative p-6 rounded-2xl border',
                tier.popular
                  ? 'border-primary bg-primary/5'
                  : 'border-border/50 bg-card/30'
              )}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  Most Popular
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <p className="text-sm text-muted-foreground">{tier.description}</p>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold">{tier.price}</span>
                {tier.period && <span className="text-muted-foreground">{tier.period}</span>}
              </div>

              <ul className="space-y-2 mb-6">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={cn('w-full', tier.popular ? '' : 'bg-secondary hover:bg-secondary/80')}
              >
                <Link href={tier.href}>{tier.cta}</Link>
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Final CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <p className="text-muted-foreground mb-4">
            Questions? We're here to help.
          </p>
          <Button asChild variant="outline">
            <Link href="/contact">Contact Sales</Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FINAL CTA SECTION
// ============================================================================

function FinalCTASection() {
  return (
    <section className="py-16 sm:py-20 border-t border-border/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
          </div>

          <div className="relative px-6 py-12 sm:px-12 sm:py-16 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Start your 7-day free trial</span>
            </motion.div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Ready to Transform Your
              <span className="block text-primary">Vinyl Business?</span>
            </h2>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Join hundreds of record stores and collectors who trust Vinylogix
              to manage their inventory and grow their passion.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button asChild size="lg" className="min-w-[180px]">
                <Link href="/register">
                  Get Started Free
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-w-[180px]">
                <Link href="/contact">Talk to Sales</Link>
              </Button>
            </div>

            <p className="mt-6 text-sm text-muted-foreground">
              No credit card required • Free plan available • Cancel anytime
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER
// ============================================================================

const footerLinks = {
  Product: [
    { href: '/pricing', text: 'Pricing' },
    { href: '/solutions', text: 'Solutions' },
    { href: '/#distributors', text: 'For Distributors' },
    { href: '/#collectors', text: 'For Collectors' },
  ],
  Resources: [
    { href: '/help', text: 'Help Center' },
    { href: '/contact', text: 'Contact' },
  ],
};

function Footer() {
  return (
    <footer className="border-t border-border/30 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Logo width={120} height={28} className="mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              The complete platform for vinyl record management.
            </p>
            <div className="flex gap-3">
              <a
                href="https://www.instagram.com/vinylogix/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://www.facebook.com/vinylogix"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.text}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Vinylogix. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  );
}

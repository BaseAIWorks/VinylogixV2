'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ScanLine,
  Keyboard,
  Disc3,
  Bot,
  Warehouse,
  ShoppingCart,
  HardHat,
  BarChart3,
  CreditCard,
  Library,
  ListChecks,
  Heart,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
}

interface ShowcaseProps {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  features: Feature[];
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
  gradientFrom: string;
  gradientTo: string;
}

const distributorFeatures: Feature[] = [
  {
    icon: ScanLine,
    title: 'Camera & Hardware Scanning',
    description: 'Use your device camera or dedicated barcode scanner for rapid inventory processing.',
  },
  {
    icon: Disc3,
    title: 'Discogs API Auto-Sync',
    description: 'Automatically pull rich metadata, tracklists, and cover art from Discogs.',
  },
  {
    icon: Bot,
    title: 'AI Content Generation',
    description: 'Create engaging artist bios and album descriptions with Gemini AI.',
  },
  {
    icon: Warehouse,
    title: 'Dual Stock Locations',
    description: 'Manage shop floor and backroom inventory with separate counters.',
  },
  {
    icon: HardHat,
    title: 'Role-Based Access',
    description: 'Assign Master or Worker roles with fine-tuned permissions.',
  },
  {
    icon: CreditCard,
    title: 'Stripe & PayPal Payments',
    description: 'Accept payments seamlessly with integrated payment processing.',
  },
];

const collectorFeatures: Feature[] = [
  {
    icon: Library,
    title: 'Personal Collection',
    description: 'Catalog your vinyl records with rich details and organization.',
  },
  {
    icon: ListChecks,
    title: 'Universal Wishlist',
    description: 'Track records you want and get notified when available.',
  },
  {
    icon: Heart,
    title: 'Favorites',
    description: 'Bookmark records from distributors for quick access.',
  },
  {
    icon: Package,
    title: 'Direct Ordering',
    description: 'Purchase directly from your local record store.',
  },
];

export function DistributorShowcase() {
  return (
    <ScrollShowcase
      id="distributors"
      badge="For Distributors"
      title="Power Tools for"
      subtitle="Record Stores"
      description="Everything you need to run a modern vinyl business, from inventory management to analytics."
      features={distributorFeatures}
      imageSrc="/Invent-app.png"
      imageAlt="Distributor inventory management dashboard"
      gradientFrom="primary"
      gradientTo="accent"
    />
  );
}

export function CollectorShowcase() {
  return (
    <ScrollShowcase
      id="collectors"
      badge="For Collectors"
      title="Your Personal"
      subtitle="Vinyl Hub"
      description="Manage your collection, discover new music, and connect with local record stores."
      features={collectorFeatures}
      imageSrc="/Client-app.png"
      imageAlt="Collector personal collection view"
      reverse
      gradientFrom="accent"
      gradientTo="primary"
    />
  );
}

function ScrollShowcase({
  id,
  badge,
  title,
  subtitle,
  description,
  features,
  imageSrc,
  imageAlt,
  reverse = false,
  gradientFrom,
  gradientTo,
}: ShowcaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  return (
    <section
      id={id}
      ref={containerRef}
      className="relative py-12 sm:py-16 overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div
          className={cn(
            'absolute h-[400px] w-[400px] rounded-full blur-[100px] opacity-20',
            reverse ? 'top-1/4 -right-32' : 'top-1/4 -left-32',
            `bg-${gradientFrom}`
          )}
          style={{
            background: `radial-gradient(circle, hsl(var(--${gradientFrom})) 0%, transparent 70%)`,
          }}
        />
      </div>

      <div className="container mx-auto px-4">
        <div
          className={cn(
            'max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-12 items-center',
            reverse && 'lg:grid-flow-col-dense'
          )}
        >
          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: reverse ? 50 : -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className={cn(reverse && 'lg:col-start-2')}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full glass-card"
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  gradientFrom === 'primary' ? 'text-primary' : 'text-accent'
                )}
              >
                {badge}
              </span>
            </motion.div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3">
              {title}
              <span
                className={cn(
                  'block mt-1 bg-gradient-to-r bg-clip-text text-transparent',
                  `from-${gradientFrom} to-${gradientTo}`
                )}
                style={{
                  backgroundImage: `linear-gradient(to right, hsl(var(--${gradientFrom})), hsl(var(--${gradientTo})))`,
                }}
              >
                {subtitle}
              </span>
            </h2>

            <p className="text-base text-muted-foreground mb-6 max-w-lg">
              {description}
            </p>

            {/* Features grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              {features.map((feature, index) => (
                <FeatureItem key={index} feature={feature} index={index} />
              ))}
            </div>
          </motion.div>

          {/* Image */}
          <motion.div
            style={{ y, opacity }}
            className={cn('relative', reverse && 'lg:col-start-1')}
          >
            <div className="relative">
              {/* Glow effect */}
              <div
                className={cn(
                  'absolute inset-0 rounded-2xl blur-3xl opacity-30',
                  `bg-${gradientFrom}`
                )}
                style={{
                  background: `linear-gradient(135deg, hsl(var(--${gradientFrom})), hsl(var(--${gradientTo})))`,
                }}
              />

              {/* Image container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative glass-card p-2 sm:p-4"
              >
                <img
                  src={imageSrc}
                  alt={imageAlt}
                  className="w-full rounded-xl shadow-2xl"
                />
              </motion.div>

              {/* Floating badges */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className={cn(
                  'absolute -bottom-6 glass-card px-4 py-3 shadow-xl',
                  reverse ? '-right-4' : '-left-4'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Setup Complete</p>
                    <p className="text-xs text-muted-foreground">Ready to go</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeatureItem({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.05 * index }}
      className="flex items-start gap-3 group"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h4 className="font-semibold text-foreground text-sm">{feature.title}</h4>
        <p className="text-xs text-muted-foreground">{feature.description}</p>
      </div>
    </motion.div>
  );
}

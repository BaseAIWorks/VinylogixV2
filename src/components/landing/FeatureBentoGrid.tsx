'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  ScanLine,
  Disc3,
  Bot,
  Warehouse,
  ShoppingCart,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BentoFeature {
  icon: React.ElementType;
  title: string;
  description: string;
  className?: string;
  gradient?: string;
}

const features: BentoFeature[] = [
  {
    icon: ScanLine,
    title: 'Instant Barcode Scanning',
    description:
      'Quickly add or find records with your device camera or dedicated hardware scanner. Eliminate tedious manual entry and process inventory at lightning speed.',
    className: 'md:col-span-2 md:row-span-2',
    gradient: 'from-primary/20 to-primary/5',
  },
  {
    icon: Disc3,
    title: 'Discogs Integration',
    description:
      'Pull rich data like tracklists, genres, and cover art automatically from Discogs.',
    className: 'md:col-span-1',
    gradient: 'from-accent/20 to-accent/5',
  },
  {
    icon: Bot,
    title: 'AI-Powered Content',
    description:
      'Generate engaging artist bios and album summaries with Gemini AI integration.',
    className: 'md:col-span-1',
    gradient: 'from-purple-500/20 to-purple-500/5',
  },
  {
    icon: Warehouse,
    title: 'Dual Stock Locations',
    description:
      'Track inventory for both your shop floor and backroom storage with separate counters and locations.',
    className: 'md:col-span-1',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
  },
  {
    icon: ShoppingCart,
    title: 'Order Management',
    description:
      'Seamless shopping cart and checkout experience with a clear dashboard to manage all orders.',
    className: 'md:col-span-1',
    gradient: 'from-orange-500/20 to-orange-500/5',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description:
      'Track sales performance, inventory valuation, and identify your most profitable records.',
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

export function FeatureBentoGrid() {
  return (
    <section className="py-12 sm:py-16 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-0 h-64 w-64 rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-1/4 right-0 h-64 w-64 rounded-full bg-accent/10 blur-[100px]" />
      </div>

      <div className="container mx-auto px-4">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            Everything You Need to
            <span className="block mt-1 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Manage Your Business
            </span>
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-base text-muted-foreground">
            From barcode scanning to AI-powered descriptions, manage your vinyl inventory
            with precision and ease.
          </p>
        </motion.div>

        {/* Bento Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-6xl mx-auto"
        >
          {features.map((feature, index) => (
            <BentoCard key={index} feature={feature} index={index} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function BentoCard({ feature, index }: { feature: BentoFeature; index: number }) {
  const Icon = feature.icon;
  const isLarge = feature.className?.includes('col-span-2') && feature.className?.includes('row-span-2');

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'group relative rounded-xl p-4 sm:p-5 overflow-hidden',
        'glass-card glass-hover',
        'transition-all duration-500',
        feature.className
      )}
    >
      {/* Gradient background */}
      <div
        className={cn(
          'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500',
          'bg-gradient-to-br',
          feature.gradient
        )}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col">
        {/* Icon */}
        <div
          className={cn(
            'inline-flex items-center justify-center rounded-lg',
            'bg-primary/10 text-primary',
            'transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20',
            isLarge ? 'w-12 h-12 mb-4' : 'w-10 h-10 mb-3'
          )}
        >
          <Icon className={isLarge ? 'w-6 h-6' : 'w-5 h-5'} />
        </div>

        {/* Text */}
        <h3
          className={cn(
            'font-semibold text-foreground mb-1',
            isLarge ? 'text-xl' : 'text-base'
          )}
        >
          {feature.title}
        </h3>
        <p
          className={cn(
            'text-muted-foreground leading-relaxed',
            isLarge ? 'text-sm' : 'text-xs'
          )}
        >
          {feature.description}
        </p>

        {/* Decorative element for large cards */}
        {isLarge && (
          <div className="mt-auto pt-4">
            <div className="flex items-center gap-2 text-sm text-primary font-medium group-hover:gap-3 transition-all">
              <span>Learn more</span>
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </div>
          </div>
        )}
      </div>

      {/* Hover glow effect */}
      <div
        className={cn(
          'absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500',
          'bg-gradient-to-r from-primary/20 via-transparent to-accent/20',
          'pointer-events-none'
        )}
        style={{
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          padding: '1px',
        }}
      />
    </motion.div>
  );
}

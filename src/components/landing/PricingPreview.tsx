'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PricingTier {
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    description: 'Perfect for small collections',
    price: 'Free',
    period: 'forever',
    features: [
      'Up to 100 records',
      'Basic inventory',
      'Personal collection',
      'Wishlist feature',
    ],
  },
  {
    name: 'Growth',
    description: 'For growing record stores',
    price: '$29',
    period: '/month',
    features: [
      'Up to 1,000 records',
      'Discogs integration',
      'Order management',
      'Basic analytics',
      '2 user accounts',
    ],
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Scale',
    description: 'For established businesses',
    price: '$79',
    period: '/month',
    features: [
      'Unlimited records',
      'AI content generation',
      'Advanced analytics',
      'Priority support',
      'Unlimited users',
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export function PricingPreview() {
  return (
    <section className="relative py-12 sm:py-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-accent/5 to-background" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[300px] w-[600px] rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="container mx-auto px-4">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full glass-card text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-medium">Simple, Transparent Pricing</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3">
            Choose Your
            <span className="block mt-1 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Perfect Plan
            </span>
          </h2>
          <p className="max-w-xl mx-auto text-base text-muted-foreground">
            Start free and scale as you grow. All plans include a 7-day trial.
          </p>
        </motion.div>

        {/* Pricing cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-6xl mx-auto"
        >
          {tiers.map((tier, index) => (
            <PricingCard key={tier.name} tier={tier} index={index} />
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <Button asChild variant="outline" className="glass-hover">
            <Link href="/pricing">
              Compare All Features
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

function PricingCard({ tier, index }: { tier: PricingTier; index: number }) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'relative group',
        tier.highlighted && 'md:-mt-2 md:mb-2'
      )}
    >
      <div
        className={cn(
          'relative h-full p-4 rounded-xl',
          'glass-card',
          tier.highlighted
            ? 'ring-2 ring-primary bg-primary/5'
            : 'glass-hover'
        )}
      >
        {/* Badge */}
        {tier.badge && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium whitespace-nowrap">
            {tier.badge}
          </div>
        )}

        {/* Header */}
        <div className="mb-3">
          <h3 className="text-lg font-semibold text-foreground">
            {tier.name}
          </h3>
          <p className="text-xs text-muted-foreground">{tier.description}</p>
        </div>

        {/* Price */}
        <div className="mb-4">
          <span className="text-3xl font-bold text-foreground">{tier.price}</span>
          <span className="text-sm text-muted-foreground ml-1">{tier.period}</span>
        </div>

        {/* Features */}
        <ul className="space-y-2 mb-4">
          {tier.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <Check className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <Button
          asChild
          size="sm"
          className={cn(
            'w-full',
            tier.highlighted
              ? 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25'
              : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          <Link href={tier.price === 'Free' ? '/register/client' : '/pricing'}>
            {tier.price === 'Free' ? 'Get Started' : 'Start Trial'}
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}

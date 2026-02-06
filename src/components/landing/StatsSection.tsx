'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useSpring, useMotionValue } from 'framer-motion';
import { Disc3, Users, Store, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stat {
  icon: React.ElementType;
  value: number;
  suffix: string;
  label: string;
  description: string;
}

const stats: Stat[] = [
  {
    icon: Disc3,
    value: 50000,
    suffix: '+',
    label: 'Records Managed',
    description: 'Vinyl records cataloged and tracked',
  },
  {
    icon: Store,
    value: 500,
    suffix: '+',
    label: 'Distributors',
    description: 'Record stores using Vinylogix',
  },
  {
    icon: Users,
    value: 10000,
    suffix: '+',
    label: 'Collectors',
    description: 'Music lovers managing collections',
  },
  {
    icon: TrendingUp,
    value: 99,
    suffix: '%',
    label: 'Uptime',
    description: 'Reliable platform availability',
  },
];

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    mass: 0.8,
    stiffness: 75,
    damping: 15,
  });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  useEffect(() => {
    const unsubscribe = springValue.on('change', (latest) => {
      setDisplayValue(Math.round(latest));
    });
    return unsubscribe;
  }, [springValue]);

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(num >= 10000 ? 0 : 1) + 'K';
    }
    return num.toString();
  };

  return (
    <span ref={ref} className="tabular-nums">
      {formatNumber(displayValue)}
      {suffix}
    </span>
  );
}

export function StatsSection() {
  return (
    <section className="relative py-12 sm:py-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-primary/10 blur-[100px]" />
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
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3">
            Trusted by the
            <span className="block mt-1 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Vinyl Community
            </span>
          </h2>
          <p className="max-w-xl mx-auto text-base text-muted-foreground">
            Join thousands of record stores and collectors who trust Vinylogix.
          </p>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {stats.map((stat, index) => (
            <StatCard key={index} stat={stat} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({ stat, index }: { stat: Stat; index: number }) {
  const Icon = stat.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group"
    >
      <div
        className={cn(
          'relative h-full p-4 rounded-xl',
          'glass-card glass-hover',
          'text-center'
        )}
      >
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
          <Icon className="w-5 h-5 text-primary" />
        </div>

        {/* Value */}
        <div className="text-3xl sm:text-4xl font-bold text-foreground mb-1">
          <AnimatedCounter value={stat.value} suffix={stat.suffix} />
        </div>

        {/* Label */}
        <h3 className="text-sm font-semibold text-foreground">
          {stat.label}
        </h3>

        {/* Hover glow */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity -z-10" />
      </div>
    </motion.div>
  );
}

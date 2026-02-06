'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Laptop, Tablet, Smartphone, Cloud, Wifi, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Device {
  icon: React.ElementType;
  name: string;
  description: string;
  features: string[];
}

const devices: Device[] = [
  {
    icon: Laptop,
    name: 'Desktop',
    description: 'The command center for your business',
    features: ['Full analytics suite', 'Bulk inventory management', 'User administration'],
  },
  {
    icon: Tablet,
    name: 'Tablet',
    description: 'Mobile point-of-sale experience',
    features: ['Floor management', 'Customer browsing', 'Quick stock checks'],
  },
  {
    icon: Smartphone,
    name: 'Mobile',
    description: 'Your business in your pocket',
    features: ['Barcode scanning', 'Order notifications', 'Inventory updates'],
  },
];

export function DeviceExperience() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  return (
    <section
      ref={containerRef}
      className="relative py-12 sm:py-16 overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/5 to-background" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[100px]" />
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 rounded-full glass-card text-sm">
            <Cloud className="w-4 h-4 text-primary" />
            <span className="font-medium">Cloud-Synced Across All Devices</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-3">
            Works Where
            <span className="block mt-1 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              You Work
            </span>
          </h2>
          <p className="max-w-xl mx-auto text-base text-muted-foreground">
            From the counter to the stockroom and beyond, Vinylogix is designed
            for every part of your business.
          </p>
        </motion.div>

        {/* 3D Device mockups */}
        <div className="relative max-w-6xl mx-auto">
          {/* Connection lines (desktop only) */}
          <div className="absolute inset-0 hidden lg:block pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <motion.path
                d="M25 50 L50 30 L75 50"
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="0.2"
                strokeDasharray="2 2"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, delay: 0.5 }}
              />
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                  <stop offset="50%" stopColor="hsl(var(--accent))" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Devices grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            {devices.map((device, index) => (
              <DeviceCard
                key={device.name}
                device={device}
                index={index}
                scrollYProgress={scrollYProgress}
              />
            ))}
          </div>
        </div>

        {/* Sync indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex justify-center"
        >
          <div className="inline-flex items-center gap-4 px-4 py-2 rounded-full glass-card text-sm">
            <div className="flex items-center gap-2">
              <Wifi className="w-3 h-3 text-green-500" />
              <span className="font-medium">Real-time Sync</span>
            </div>
            <div className="w-px h-3 bg-border" />
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3 text-yellow-500" />
              <span className="font-medium">Instant Updates</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function DeviceCard({
  device,
  index,
  scrollYProgress,
}: {
  device: Device;
  index: number;
  scrollYProgress: any;
}) {
  const Icon = device.icon;
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [index === 1 ? -30 : 30, index === 1 ? 30 : -30]
  );

  return (
    <motion.div
      style={{ y: index === 1 ? undefined : y }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className={cn(
        'group relative',
        index === 1 && 'md:-mt-4'
      )}
    >
      <div
        className={cn(
          'relative p-5 rounded-xl',
          'glass-card glass-hover',
          'text-center',
          index === 1 && 'ring-2 ring-primary/20'
        )}
      >
        {/* Highlight badge for main device */}
        {index === 1 && (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
            Primary
          </div>
        )}

        {/* Device icon */}
        <div className="relative mb-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="relative mx-auto w-16 h-16"
          >
            <div
              className={cn(
                'absolute inset-0 flex items-center justify-center rounded-xl',
                'bg-gradient-to-br from-primary/20 to-accent/20',
                index === 1 && 'from-primary/30 to-accent/30'
              )}
            >
              <Icon
                className={cn(
                  'w-8 h-8',
                  index === 1 ? 'text-primary' : 'text-foreground/70'
                )}
              />
            </div>
          </motion.div>
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {device.name}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">{device.description}</p>

        {/* Features */}
        <ul className="space-y-1">
          {device.features.map((feature, i) => (
            <li
              key={i}
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground"
            >
              <span className="w-1 h-1 rounded-full bg-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

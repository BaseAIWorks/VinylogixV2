'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Disc3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VinylRecordSVG } from './VinylRecordSVG';

export function FinalCTA() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <section
      ref={containerRef}
      className="relative py-16 sm:py-20 overflow-hidden"
    >
      {/* Animated background */}
      <div className="absolute inset-0 -z-20">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/10 to-background" />

        {/* Floating vinyl records */}
        <motion.div
          className="absolute -left-20 top-1/4 opacity-10 hidden lg:block"
          style={{ y }}
        >
          <div className="animate-float">
            <VinylRecordSVG size={250} spinning />
          </div>
        </motion.div>
        <motion.div
          className="absolute -right-16 bottom-1/4 opacity-10 hidden lg:block"
          style={{ y: useTransform(scrollYProgress, [0, 1], [-50, 50]) }}
        >
          <div className="animate-float-slow">
            <VinylRecordSVG size={200} />
          </div>
        </motion.div>

        {/* Glow effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full bg-primary/20 blur-[120px] animate-glow-pulse" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          style={{ opacity }}
          className="max-w-6xl mx-auto text-center"
        >
          {/* Glassmorphism card */}
          <div className="relative">
            {/* Outer glow */}
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 blur-xl opacity-50" />

            {/* Main card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative glass-card p-8 sm:p-10 rounded-2xl"
            >
              {/* Decorative icon */}
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
                className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/20 mb-5"
              >
                <Disc3 className="w-7 h-7 text-primary" />
              </motion.div>

              {/* Headline */}
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight mb-4">
                Ready to Transform
                <span className="block mt-1 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer">
                  Your Vinyl Workflow?
                </span>
              </h2>

              {/* Description */}
              <p className="text-base text-muted-foreground mb-6 max-w-xl mx-auto">
                Stop juggling spreadsheets and start using a tool built for the
                love of vinyl. Join thousands of collectors and distributors today.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="h-11 px-6 rounded-xl shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all duration-300 group"
                >
                  <Link href="/register">
                    Start Your Free Trial
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-11 px-6 rounded-xl glass-hover"
                >
                  <Link href="/contact">Contact Sales</Link>
                </Button>
              </div>

              {/* Trust indicators */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4 text-green-500"
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
                    <span>No credit card required</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4 text-green-500"
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
                    <span>7-day full access</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg
                      className="w-4 h-4 text-green-500"
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
                    <span>Cancel anytime</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

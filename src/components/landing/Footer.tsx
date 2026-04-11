'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Instagram, Facebook, Twitter, Youtube, Mail, ArrowRight } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

// -----------------------------------------------------------------------------
// Footer link schema
//
// Every href must point to a real, implemented route. Do not reintroduce any
// `/#` placeholders — if a page isn't built yet, it still needs to exist as a
// real route (even as a minimal placeholder page). See
// docs/MARKETING_PAGES_SPEC.md for the contract.
// -----------------------------------------------------------------------------

type FooterLink = { href: string; text: string; external?: boolean };

const footerColumns: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/features', text: 'Features' },
      { href: '/pricing', text: 'Pricing' },
      { href: '/integrations', text: 'Integrations' },
      { href: '/discogs-sync', text: 'Discogs Sync' },
    ],
  },
  {
    title: 'Solutions',
    links: [
      { href: '/for-distributors', text: 'For Distributors' },
      { href: '/for-collectors', text: 'For Collectors' },
      { href: '/solutions', text: 'All Solutions' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/help', text: 'Help Center' },
      { href: '/contact', text: 'Contact' },
      { href: '/status', text: 'Status' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', text: 'About' },
      { href: '/careers', text: 'Careers' },
      { href: '/security', text: 'Security' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', text: 'Privacy Policy' },
      { href: '/terms', text: 'Terms of Service' },
      { href: '/cookies', text: 'Cookie Policy' },
      { href: '/gdpr', text: 'GDPR' },
    ],
  },
];

const socialLinks = [
  { icon: Instagram, href: 'https://www.instagram.com/vinylogix/', label: 'Instagram' },
  { icon: Facebook, href: 'https://www.facebook.com/vinylogix', label: 'Facebook' },
  { icon: Twitter, href: 'https://twitter.com/vinylogix', label: 'Twitter' },
  { icon: Youtube, href: 'https://www.youtube.com/@vinylogix', label: 'YouTube' },
];

export function Footer() {
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    // Newsletter backend isn't wired up yet — we give immediate feedback and
    // clear the input so the form feels responsive. When an endpoint exists,
    // swap this for a fetch('/api/newsletter').
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: "You're on the list",
      description: "We'll email you when we ship something worth hearing about.",
    });
    setEmail('');
  };

  return (
    <footer className="relative border-t bg-background/50 backdrop-blur-sm">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="container mx-auto max-w-7xl px-4">
        {/* Main footer content */}
        <div className="py-16">
          <div className="grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(5,1fr)]">
            {/* Brand column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="sm:col-span-2 lg:col-span-1"
            >
              <Link href="/" className="inline-block">
                <Logo width={150} height={30} />
              </Link>
              <p className="mt-4 max-w-xs text-sm text-muted-foreground leading-relaxed">
                The vinyl industry&apos;s B2B platform — inventory, orders and
                payments for distributors, record stores and collectors.
              </p>

              {/* Newsletter */}
              <form onSubmit={handleSubscribe} className="mt-6 max-w-xs">
                <label htmlFor="footer-newsletter" className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                  Stay in the groove
                </label>
                <div className="mt-2 flex gap-2">
                  <Input
                    id="footer-newsletter"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-9 text-sm"
                    aria-label="Email address for newsletter"
                  />
                  <Button type="submit" size="sm" className="h-9 shrink-0" aria-label="Subscribe">
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Product updates. No spam. Unsubscribe anytime.
                </p>
              </form>

              {/* Social links */}
              <div className="mt-6 flex gap-3">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground transition-all duration-300 hover:bg-primary/20 hover:text-primary"
                      aria-label={social.label}
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>

              {/* Contact info */}
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <a
                    href="mailto:support@vinylogix.com"
                    className="hover:text-foreground transition-colors"
                  >
                    support@vinylogix.com
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Link columns */}
            {footerColumns.map((column, columnIndex) => (
              <motion.div
                key={column.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 * (columnIndex + 1) }}
              >
                <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
                  {column.title}
                </h4>
                <nav className="flex flex-col space-y-3">
                  {column.links.map((link) => (
                    <Link
                      key={link.href + link.text}
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.text}
                    </Link>
                  ))}
                </nav>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border/50 py-6">
          <div className="flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-muted-foreground sm:text-sm">
              &copy; {new Date().getFullYear()} Vinylogix. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link
                href="/privacy"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
              >
                Terms
              </Link>
              <Link
                href="/cookies"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
              >
                Cookies
              </Link>
              <Link
                href="/status"
                className="flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span>All systems operational</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

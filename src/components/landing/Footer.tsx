'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Instagram, Facebook, Twitter, Youtube, Mail } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

const footerLinks = {
  Product: [
    { href: '/solutions', text: 'Solutions' },
    { href: '/pricing', text: 'Pricing' },
    { href: '/#distributors', text: 'For Distributors' },
    { href: '/#collectors', text: 'For Collectors' },
  ],
  Company: [
    { href: '/#', text: 'About Us' },
    { href: '/#', text: 'Our Team' },
    { href: '/#', text: 'Careers' },
    { href: '/#', text: 'Blog' },
  ],
  Resources: [
    { href: '/help', text: 'Help Center' },
    { href: '/contact', text: 'Contact Support' },
    { href: '/#', text: 'API Documentation' },
    { href: '/#', text: 'Status Page' },
  ],
  Legal: [
    { href: '/#', text: 'Privacy Policy' },
    { href: '/#', text: 'Terms of Service' },
    { href: '/#', text: 'Cookie Policy' },
    { href: '/#', text: 'GDPR' },
  ],
};

const socialLinks = [
  { icon: Instagram, href: 'https://www.instagram.com/vinylogix/', label: 'Instagram' },
  { icon: Facebook, href: 'https://www.facebook.com/vinylogix', label: 'Facebook' },
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Youtube, href: '#', label: 'YouTube' },
];

export function Footer() {
  return (
    <footer className="relative border-t bg-background/50 backdrop-blur-sm">
      {/* Top gradient line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      <div className="container mx-auto max-w-7xl px-4">
        {/* Main footer content */}
        <div className="py-16">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-6">
            {/* Brand column */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-2"
            >
              <Link href="/" className="inline-block">
                <Logo width={150} height={30} />
              </Link>
              <p className="mt-4 max-w-xs text-muted-foreground">
                The ultimate platform for vinyl record stores and collectors to
                manage their inventory and passion.
              </p>

              {/* Social links */}
              <div className="mt-6 flex gap-4">
                {socialLinks.map((social) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary/50 text-muted-foreground hover:bg-primary/20 hover:text-primary transition-all duration-300"
                      aria-label={social.label}
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>

              {/* Contact info */}
              <div className="mt-8 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  <a href="mailto:support@vinylogix.com" className="hover:text-foreground transition-colors">
                    support@vinylogix.com
                  </a>
                </div>
              </div>
            </motion.div>

            {/* Links columns */}
            {Object.entries(footerLinks).map(([title, links], columnIndex) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * columnIndex }}
              >
                <h4 className="font-semibold text-foreground mb-4">{title}</h4>
                <nav className="flex flex-col space-y-3">
                  {links.map((link) => (
                    <Link
                      key={link.href + link.text}
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
        <div className="py-6 border-t border-border/50">
          <div className="flex flex-col-reverse items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Vinylogix. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link
                href="/#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Terms & Conditions
              </Link>
              <Link
                href="/#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </Link>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span>All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const components = [
  { name: "Website" },
  { name: "Storefronts" },
  { name: "Order processing" },
  { name: "Payments (Stripe)" },
  { name: "Search" },
];

export default function StatusPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Activity className="h-4 w-4" />
            System Status
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            System Status
          </h1>
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-green-500/20 bg-green-500/5 px-6 py-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
            </span>
            <span className="text-lg font-semibold text-green-700 dark:text-green-400">
              All systems operational
            </span>
          </div>
        </div>
      </section>

      {/* Components list */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border bg-card overflow-hidden">
            <div className="px-6 py-4 border-b bg-muted/30">
              <h2 className="text-lg font-semibold">Platform components</h2>
            </div>
            <ul className="divide-y">
              {components.map((component) => (
                <li
                  key={component.name}
                  className="flex items-center justify-between px-6 py-4"
                >
                  <span className="text-sm font-medium text-foreground/90">
                    {component.name}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      "bg-green-500/10 text-green-700 dark:text-green-400"
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Operational
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Transparency note */}
          <div className="mt-6 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground/80">Note:</span> This is a static status page for now. We&apos;re working on live uptime monitoring — in the meantime, for urgent issues contact{" "}
              <a
                href="mailto:support@vinylogix.com"
                className="font-medium text-primary hover:underline"
              >
                support@vinylogix.com
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Subscribe to status updates via email?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Get in touch and we will add you to outage notifications as we roll out live monitoring.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/contact">
                Contact us <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

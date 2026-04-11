"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Cookie, Lock, CreditCard, Server, Download, Users, Globe } from "lucide-react";

export default function CookiesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Cookie className="h-4 w-4" />
            Legal
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Cookie Policy
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Currently being prepared. Last reviewed: pending.
          </p>
        </div>
      </section>

      {/* Main section */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-3xl px-4">
          {/* Callout card */}
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-8 sm:p-10 text-center">
            <div className="inline-flex rounded-full bg-primary/10 p-3 mb-4">
              <Cookie className="h-6 w-6 text-primary" />
            </div>
            <p className="text-lg font-medium leading-relaxed max-w-xl mx-auto">
              Our Cookie Policy is being prepared. For any questions about how we use
              cookies or tracking on this site, please email us at{" "}
              <a
                href="mailto:support@vinylogix.com"
                className="text-primary underline underline-offset-2"
              >
                support@vinylogix.com
              </a>{" "}
              and we&apos;ll respond personally.
            </p>
          </div>

          {/* What we can tell you now */}
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-6">What we can tell you now</h2>
            <p className="text-sm text-muted-foreground mb-6">
              While the full Cookie Policy is being prepared, here are factual details
              about how tracking and sessions work on the platform today:
            </p>
            <ul className="space-y-4">
              {[
                {
                  icon: Lock,
                  text: "Session cookies are used to keep you logged in. All session data is transmitted over HTTPS only.",
                },
                {
                  icon: CreditCard,
                  text: "Payment flows handled by Stripe and PayPal may set their own cookies during checkout. Vinylogix does not store card data.",
                },
                {
                  icon: Server,
                  text: "The platform is hosted on Firebase (Google Cloud). Firebase may set functional cookies as part of its authentication and hosting infrastructure.",
                },
                {
                  icon: Download,
                  text: "You can export your full account data as CSV at any time — your information is not held hostage behind the platform.",
                },
                {
                  icon: Users,
                  text: "Role-based access controls are enforced server-side, not by tracking cookies — permissions are tied to your authenticated account.",
                },
                {
                  icon: Globe,
                  text: "No third-party advertising cookies are used. Vinylogix does not sell data to ad networks.",
                },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                  <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{item.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-muted-foreground">
              These points describe the current state of the platform and are not a
              legal guarantee. The full Cookie Policy, once published, will be the
              binding document.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Have a question we haven&apos;t answered?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Questions about cookies, tracking, or how your session data is handled?
            We&apos;re here.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/contact">
                Contact Us <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Scale, Lock, CreditCard, Server, Download, Users, Globe } from "lucide-react";

export default function GdprPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Scale className="h-4 w-4" />
            Legal
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            GDPR
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
              <Scale className="h-6 w-6 text-primary" />
            </div>
            <p className="text-lg font-medium leading-relaxed max-w-xl mx-auto">
              Our GDPR information is being prepared. For any questions about your EU
              data rights — including access, rectification, erasure, or portability —
              please email us at{" "}
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
              While the full GDPR documentation is being prepared, here are factual
              details about how the platform handles EU data rights today:
            </p>
            <ul className="space-y-4">
              {[
                {
                  icon: Download,
                  text: "Data portability: you can export your full account data — inventory, orders, clients — as CSV at any time. No waiting period, no support ticket required.",
                },
                {
                  icon: Lock,
                  text: "All data is transmitted over HTTPS. Vinylogix does not transmit personal data over unencrypted channels.",
                },
                {
                  icon: CreditCard,
                  text: "Payment card data is processed exclusively by Stripe and PayPal — both of which maintain their own GDPR and PCI DSS compliance programmes. Vinylogix never holds card data.",
                },
                {
                  icon: Server,
                  text: "Platform data is stored on Firebase (Google Cloud), which operates data centres in the EU and maintains its own data processing agreements.",
                },
                {
                  icon: Users,
                  text: "Role-based access control limits which staff can view customer personal data. Activity logging provides an audit trail of data access within your account.",
                },
                {
                  icon: Globe,
                  text: "EU VAT, reverse-charge, and VIES validation are supported. EORI numbers can be stored for cross-border B2B shipments.",
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
              legal guarantee or a Data Processing Agreement. The full GDPR
              documentation, once published, will be the binding document. To exercise
              your rights under GDPR (access, erasure, portability, objection), email{" "}
              <a href="mailto:support@vinylogix.com" className="text-primary underline underline-offset-2">
                support@vinylogix.com
              </a>.
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
            Questions about EU data rights, data retention, or how your information
            is handled? We reply personally.
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

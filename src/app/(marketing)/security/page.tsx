"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Shield,
  Lock,
  Eye,
  Database,
  Mail,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SecurityPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Shield className="h-4 w-4" />
            Security &amp; data handling
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your data, handled with care
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            We built Vinylogix for B2B relationships built on trust. Here is exactly how we protect your business data, handle payments, and respect your rights as an EU operator.
          </p>
        </div>
      </section>

      {/* Core principles */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Four core principles
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Every security and privacy decision we make traces back to these commitments.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Lock,
                title: "Encryption in transit",
                desc: "All traffic between your browser and Vinylogix is served over HTTPS. Data in motion is encrypted end-to-end so catalogue prices, order details, and client information are never exposed on the wire.",
              },
              {
                icon: Shield,
                title: "Payment safety",
                desc: "Raw card numbers never touch our servers. Stripe Connect and PayPal handle all PCI-compliant card processing. We receive a payment reference and status only — not cardholder data.",
              },
              {
                icon: Eye,
                title: "Access control",
                desc: "Role-based permissions with three levels — Master, Worker, and Viewer — let you decide exactly who sees what. Workers can be restricted to specific operations; buyers only ever see selling prices, never your costs.",
              },
              {
                icon: Database,
                title: "Data portability",
                desc: "Your inventory, orders, and client records belong to you. Export everything as CSV at any time, with no fees and no lock-in. Activity logging creates an audit trail for your own records.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Payment data */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div
            className={cn(
              "rounded-2xl border border-primary/30 bg-primary/[0.03] p-6 sm:p-10 ring-1 ring-primary/20 shadow-xl shadow-primary/10"
            )}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-primary/10 p-2.5">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold sm:text-3xl">
                We never touch your card data
              </h2>
            </div>
            <p className="text-muted-foreground leading-relaxed max-w-2xl">
              When a buyer checks out on your Vinylogix storefront, card entry happens inside a Stripe-hosted iframe or a PayPal-hosted flow. Neither the card number, CVV, nor expiry date passes through our systems.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  What Stripe / PayPal handle
                </p>
                <ul className="space-y-2 text-sm text-foreground/80">
                  {[
                    "Card tokenisation and encryption",
                    "PCI DSS compliance and auditing",
                    "Fraud detection and 3-D Secure",
                    "Chargeback and dispute management",
                    "Payouts to your connected bank account",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  What Vinylogix stores
                </p>
                <ul className="space-y-2 text-sm text-foreground/80">
                  {[
                    "Payment status (paid / pending / refunded)",
                    "Stripe payment intent ID for reconciliation",
                    "Invoice amounts and line items",
                    "No card numbers, CVVs, or expiry dates — ever",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* EU rights */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="grid gap-10 lg:grid-cols-2 items-start">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Your EU rights
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Vinylogix is designed for European B2B commerce. We align our data handling with GDPR principles — including lawful basis for processing, data minimisation, and the right to export or delete your data. We do not claim GDPR certification, but we do support the rights it protects.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-foreground/80">
                {[
                  "Export all your data as CSV at any time, from the dashboard",
                  "EU VAT validation via VIES on every B2B transaction",
                  "Reverse charge support for intra-EU B2B sales",
                  "EORI number field for cross-border shipments",
                  "Contact support@vinylogix.com to request data deletion",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-card p-6 sm:p-8">
              <h3 className="text-xl font-semibold mb-4">Infrastructure</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Vinylogix runs on <strong className="text-foreground/90">Firebase / Google Cloud</strong>, one of the most audited and reliable cloud platforms available. Google Cloud holds numerous compliance certifications on the infrastructure layer — though those certifications apply to Google, not to the Vinylogix application itself.
              </p>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Firestore (our database) encrypts data at rest by default. Application-level access is gated by Firebase Authentication and our own role-based permission checks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Responsible disclosure */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-full bg-primary/10 p-2.5">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Responsible disclosure</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                If you discover a security vulnerability in Vinylogix, please report it responsibly. We will investigate every report and respond within 72 hours. We ask that you do not publicly disclose the issue until we have had a chance to address it.
              </p>
              <div className="mt-6">
                <a
                  href="mailto:security@vinylogix.com"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  security@vinylogix.com
                </a>
              </div>
            </div>

            {/* What we don't claim */}
            <div className="rounded-2xl border bg-muted/40 p-6 sm:p-8">
              <h2 className="text-xl font-semibold mb-4">What we do not claim</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We believe transparency builds more trust than marketing copy. So here is what we have not done yet:
              </p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  We have not pursued <strong className="text-foreground/80">SOC 2</strong> or <strong className="text-foreground/80">ISO 27001</strong> certification yet.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  We are not <strong className="text-foreground/80">HIPAA</strong> compliant (irrelevant to our use case, but worth stating clearly).
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  We do not hold <strong className="text-foreground/80">PCI Level 1</strong> certification — we delegate all card processing to Stripe and PayPal, who are certified.
                </li>
              </ul>
              <p className="mt-4 text-sm text-muted-foreground">
                As Vinylogix grows, we will share any certification milestones here. If these certifications are a hard requirement for your organisation, reach out and we can discuss.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Questions about security or compliance?
          </h2>
          <p className="mt-3 text-muted-foreground">
            We are happy to answer specific questions about how we handle your data. Get in touch and we will respond within one business day.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/contact">
                Contact us <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/get-started">Get Started</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

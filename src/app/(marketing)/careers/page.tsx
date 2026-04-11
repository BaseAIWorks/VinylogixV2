"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Briefcase, Lightbulb, Gem, Shield, Mail } from "lucide-react";

export default function CareersPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Briefcase className="h-4 w-4" />
            We&apos;re hiring
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Careers at Vinylogix
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            We&apos;re a small team building focused software for a specific industry.
            Right now we have no open roles — but we&apos;re always interested in
            hearing from people who care about the craft.
          </p>
        </div>
      </section>

      {/* No open roles */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="rounded-2xl border bg-card p-8 sm:p-10 text-center">
            <div className="inline-flex rounded-full bg-primary/10 p-3 mb-4">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold sm:text-3xl">No open roles right now</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-xl mx-auto">
              We&apos;re a small, lean team and we hire slowly when we do. We&apos;d rather
              build the right product with a few focused people than scale headcount ahead
              of the work. If you think you&apos;d be a great fit for where we&apos;re going,
              send us a note — we keep a list and reach out when something opens up.
            </p>
            <a
              href="mailto:support@vinylogix.com"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <Mail className="h-4 w-4" />
              support@vinylogix.com
            </a>
          </div>
        </div>
      </section>

      {/* What we&apos;d look for */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What we&apos;d look for if we were hiring
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              Not job requirements — just the things that matter most to how we work.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                icon: Lightbulb,
                title: "Curiosity",
                desc: "You dig into the problem before reaching for the solution. You want to understand why the vinyl industry works the way it does, not just what the ticket says to build.",
              },
              {
                icon: Gem,
                title: "Craft",
                desc: "You care about the details — a clear error message, a well-named variable, an interaction that feels right. You're not satisfied with something that merely works.",
              },
              {
                icon: Shield,
                title: "Ownership",
                desc: "You see a problem through to the end. You don't hand it off at the first obstacle. When something ships broken, you notice and you fix it.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <div className="rounded-lg bg-primary/10 p-2.5 w-fit">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Got a question for the team?</h2>
          <p className="mt-3 text-muted-foreground">
            Whether it&apos;s about working here or using the platform, we reply personally.
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

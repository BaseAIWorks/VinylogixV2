# Vinylogix Marketing Pages Spec

This document is the **single source of truth** for every agent building or
editing a public-facing page on vinylogix.com. Read it completely before
touching any file. Every page must conform to the rules here so the site feels
like one coherent product.

---

## 1. Scope of this document

- Applies to: everything under `src/app/(marketing)/**`, plus the shared
  `Header` and `Footer` in `src/components/landing/`.
- Does NOT apply to: `(app)` (authed app), `(auth)` (login/register),
  `/storefront/**`, `/admin/**`, or API routes.

---

## 2. File / route layout

All public marketing pages live inside the `(marketing)` route group so they
automatically get the shared `Header` + `Footer` via the group layout.

```
src/app/
├── layout.tsx                  # root layout — unchanged (html, body, AuthProvider)
├── (marketing)/
│   ├── layout.tsx              # Header + <main>{children}</main> + Footer
│   ├── page.tsx                # "/" — renders <UnifiedLanding />
│   ├── solutions/page.tsx
│   ├── pricing/page.tsx
│   ├── help/page.tsx
│   ├── contact/page.tsx
│   ├── features/page.tsx
│   ├── about/page.tsx
│   ├── careers/page.tsx
│   ├── security/page.tsx
│   ├── integrations/page.tsx
│   ├── discogs/page.tsx
│   ├── status/page.tsx
│   ├── for-distributors/page.tsx
│   ├── for-collectors/page.tsx
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   ├── cookies/page.tsx
│   └── gdpr/page.tsx
├── (app)/ …                    # untouched
├── (auth)/ …                   # untouched
└── [slug]/page.tsx              # untouched — static routes win
```

**Absolute rule:** pages inside `(marketing)/**` must NOT import `Header` or
`Footer` themselves. The layout provides them. If you find an existing page
doing it (e.g. the old `pricing/page.tsx`), delete the import and the JSX usage.

---

## 3. Header nav structure (FINAL)

Implemented in `src/components/landing/Header.tsx`.

**Desktop nav items (left-to-right):**

| # | Item       | Type     | Contents                                                                                   |
|---|------------|----------|--------------------------------------------------------------------------------------------|
| 1 | Product    | dropdown | Features → `/features` · Integrations → `/integrations` · Discogs Sync → `/discogs-sync` · Security → `/security` |
| 2 | Solutions  | dropdown | For Distributors → `/for-distributors` · For Collectors → `/for-collectors` · All Solutions → `/solutions` |
| 3 | Pricing    | link     | → `/pricing`                                                                               |
| 4 | Company    | dropdown | About → `/about` · Careers → `/careers` · Contact → `/contact`                             |

**Right side (unauthenticated):**
- `Log in` (ghost button) → `/login`
- `Get Started` (primary button) → `/get-started`

**Right side (authenticated):** unchanged — existing avatar dropdown with
Dashboard / Settings / Log out.

**Resources removed from top nav** by product decision. Help Center, Contact,
and Status still live in the **footer** under the Resources column. Contact
was moved into the Company dropdown so it remains reachable from the top nav
without a dedicated Resources menu.

**Mobile:** slide-in drawer (Sheet component). Shows all four top-level items
as accordion sections with their sub-items. Must include the Log in + Get
Started CTAs at the bottom. Do not just hide the nav on mobile.

**NO blog. NO changelog.** Per user instruction.

---

## 4. Footer structure (FINAL)

Implemented in `src/components/landing/Footer.tsx`.

**5 link columns + brand column:**

| Brand column         | Product       | Solutions           | Resources    | Company   | Legal             |
|----------------------|---------------|---------------------|--------------|-----------|-------------------|
| Logo                 | Features      | For Distributors    | Help Center  | About     | Privacy Policy    |
| Tagline              | Pricing       | For Collectors      | Contact      | Careers   | Terms of Service  |
| Newsletter signup    | Integrations  | All Solutions       | Status       | Security  | Cookie Policy     |
| Social icons (4)     | Discogs Sync  |                     |              |           | GDPR              |
| support@vinylogix…   |               |                     |              |           |                   |

**Bottom bar:**
- © {year} Vinylogix. All rights reserved.
- Inline links: Privacy · Terms · Cookies
- "All systems operational" dot → `/status`

**NO blog. NO changelog.** Per user instruction.

**Every link must point to a real route.** No `/#` placeholders anywhere. If a
page is a thin placeholder (e.g. `/careers`), it still exists as a real route
— the footer link goes there, not to `/#`.

**Tagline (use this exact copy):**
> The vinyl industry's B2B platform — inventory, orders and payments for
> distributors, record stores and collectors.

---

## 5. Product facts (use these, don't guess)

Pulled from `src/services/*.ts`, `src/app/(app)/manual/page.tsx`, and
`src/app/help/page.tsx`.

### Elevator pitch
Vinylogix is a B2B platform for vinyl distributors and record stores to manage
inventory, run a branded storefront, and process wholesale orders with
integrated payments. Collectors get a free account to catalog their collection
and buy from shops on the platform.

### Audiences (three)
- **Distributors / wholesalers** — source from labels, sell bulk to stores
- **Record stores** — retail shops; also sometimes sell wholesale
- **Collectors** — catalog personal collection, buy from shops on the platform

### Core capabilities
- **Inventory:** barcode scanning (camera or hardware), multi-location stock
  (shelf vs storage), Goldmine condition grading (M/NM/VG+/VG/G+/G/F/P),
  supplier tracking, CSV export, bulk operations
- **Storefront:** custom-branded public catalog, filtering, search, access
  control (open / private / invite-only)
- **Orders:** cart-based checkout, statuses (awaiting approval → pending →
  processing → shipped → completed / cancelled / on hold), refunds with stock
  restoration, carrier tracking (PostNL, DHL, UPS, FedEx, DPD, GLS)
- **Payments:** Stripe Connect (1.5%–3.25% + €0.25 per tx) or PayPal;
  auto-generated invoices; multi-account tracking
- **CRM:** client accounts, wishlist, favorites, access control per client
- **Analytics:** sales performance, inventory valuation, top products, genre
  mix, client lifetime value; filter by 7/30/90 days / YTD / custom
- **Roles:** Master (owner), Worker (customizable permissions), Viewer
  (client/purchaser)
- **Content:** AI artist bios + album descriptions (Scale tier only), AI cover
  recognition
- **Shipping & tax:** weight-tiered shipping zones, free-shipping thresholds,
  pickup option, Stripe Tax, reverse charge for EU B2B, EORI support

### Integrations (real, wired up)
- **Discogs** — barcode lookup, catalog data (artist/title/cover/tracklist/
  year/label/format), collector collection sync. NOT a bidirectional marketplace
  sync and NOT a Discogs redirect.
- **Stripe Connect** — merchant payouts, checkout, refunds
- **Stripe Tax** — optional automated tax
- **PayPal** — alternative checkout
- **Carriers** — PostNL, DHL, UPS, FedEx, DPD, GLS (tracking links)
- **Firebase / Google Cloud** — hosting + Firestore data layer

### Pricing (source: `src/services/client-subscription-service.ts`)

| Tier       | Monthly | Quarterly | Yearly | Records    | Users  | Tx fee | Notes                              |
|------------|---------|-----------|--------|------------|--------|--------|------------------------------------|
| Pay-as-you-go | €0   | —         | —      | 50         | 1      | 6%     | No monthly commitment              |
| Essential  | €9      | €25       | €90    | 100        | 2      | 4%     | 7-day free trial                   |
| Growth     | €29     | €79       | €290   | 1,000      | 10     | 3%     | **Most popular**, 7-day free trial |
| Scale      | €79     | €220      | €790   | unlimited  | unlimited | 2%  | AI descriptions, 7-day free trial  |
| Collector  | free    | —         | —      | unlimited  | 1      | —      | Personal catalog + buy from shops  |

**Note:** there is a paid `collector` tier in code (€4.99/mo) but the onboarding
flow advertises Collector as "Free forever." Use the free framing on marketing
pages.

### Security / trust facts (only claim these, nothing else)
- HTTPS everywhere
- Payment card data never hits Vinylogix servers — Stripe + PayPal handle PCI
- Firebase (Google Cloud) for hosting + data
- Role-based access control with granular permissions
- Activity logging for audit trail
- Data export at any time (CSV)
- EU VAT / reverse-charge / VIES validation support

---

## 6. "Don't invent" rules

Per user instruction, do NOT:

- ❌ Fabricate customer testimonials, quotes, names, store names, or logos.
  **Skip testimonial sections entirely.** Do not leave visible placeholders
  like "Sarah from East Coast Records" — just omit the section.
- ❌ Claim compliance certifications that aren't real (SOC 2, ISO 27001,
  HIPAA). Only claim what section 5 lists.
- ❌ Invent metrics or stats. If you need a number, use the ones already on
  the landing page (50K+ records, 500+ distributors, 10K+ collectors) but
  frame them factually, not as "customers".
- ❌ Write real blog posts or changelog entries. `/blog` and `/changelog` are
  NOT being built in this pass.
- ❌ Write real legal text for `/privacy`, `/terms`, `/cookies`, `/gdpr`. Per
  user instruction, these are **"keep empty prepared page"** — they need a
  proper page shell (hero, section, contact CTA) with a clearly-marked
  "Legal content being prepared" block directing readers to contact
  `support@vinylogix.com` for questions. Do not write lorem ipsum; do not
  write draft-looking legal prose.
- ❌ Add new runtime dependencies to `package.json` unless absolutely
  required. Use what's already installed.

DO:
- ✅ Use only facts from section 5.
- ✅ Cite integrations, features, and tier details verbatim.
- ✅ Write B2B, vinyl-industry-literate copy. Avoid generic "transform your
  business" SaaS filler.

---

## 7. Page scaffolding pattern

Every new marketing page follows this shape. Match the style of the existing
`/pricing` page — that's the reference for tone and layout.

```tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, /* relevant icons */ } from "lucide-react";

export default function SomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            {/* badge */}
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {/* headline */}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {/* subhead */}
          </p>
        </div>
      </section>

      {/* Content sections — py-16 sm:py-24 containers, max-w-5xl or max-w-6xl */}

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{/* ... */}</h2>
          <p className="mt-3 text-muted-foreground">{/* ... */}</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg"><Link href="/get-started">Get Started <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/pricing">View Pricing</Link></Button>
          </div>
        </div>
      </section>
    </>
  );
}
```

**Do NOT render `<Header />` or `<Footer />` inside the page.** The layout
provides them. The page exports only its sections, wrapped in a fragment or
a `<div className="flex flex-col min-h-screen">` if needed.

---

## 8. Design tokens

Match the existing `/pricing` page.

- **Type:** `text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl` for
  page H1; `text-3xl font-bold tracking-tight sm:text-4xl` for section H2;
  `text-xl font-semibold` for card titles.
- **Containers:** `container mx-auto max-w-6xl px-4` (hero / wide grids),
  `max-w-5xl` (feature comparisons), `max-w-2xl` (CTA blocks).
- **Sections:** `py-16 sm:py-24` with `border-t` between content and CTA.
- **Cards:** `rounded-2xl border bg-card p-6 sm:p-8`. Primary/highlight cards
  use `border-primary/30 bg-primary/[0.03] ring-1 ring-primary/20 shadow-xl
  shadow-primary/10`.
- **Muted blocks:** `rounded-lg bg-muted/50 p-4` for "Best for" callouts.
- **Accent badges:** `inline-flex items-center gap-1 rounded-full
  bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-700` (free
  forever), `bg-primary/10 text-primary` (trial badges).
- **Check-list items:** `Check` icon from lucide-react, `mt-0.5 h-4 w-4
  shrink-0 text-primary`, text `text-sm text-foreground/80`.
- **Icons:** lucide-react only. No new icon libraries.
- **Animation:** framer-motion is fine (already used). Don't add new animation
  libs.

---

## 9. Accessibility + SEO non-negotiables

- Every page has exactly one `<h1>`.
- Every image has a meaningful `alt`.
- External links have `target="_blank" rel="noopener noreferrer"`.
- Each page exports a `metadata` or sets `<title>` via head — at minimum, the
  root layout title `"Vinylogix - Your Ultimate Vinyl Manager"` stays in
  place, pages don't need per-page metadata for this pass but can add it.

---

## 10. Agent coordination rules

Every agent working on these pages must:

1. Read this file completely before editing any code.
2. Only touch files inside its assigned cluster (see phase plan).
3. Never touch `src/app/(marketing)/layout.tsx`, `Header.tsx`, `Footer.tsx`,
   or `package.json` — those are Phase 1, owned by the foundation pass.
4. Never create fake testimonials, logos, or legal text.
5. Never claim certifications not in section 5.
6. Report back with: files created, files modified, any deviation from the
   spec and why.

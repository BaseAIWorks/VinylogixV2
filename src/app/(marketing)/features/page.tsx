"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ScanLine,
  Disc3,
  Bot,
  Warehouse,
  Package,
  TableProperties,
  Truck,
  Weight,
  Store,
  Palette,
  Eye,
  Users,
  Heart,
  UserPlus,
  ShoppingCart,
  RefreshCw,
  Map,
  MapPin,
  Clock,
  CreditCard,
  Wallet,
  Receipt,
  FileText,
  Calculator,
  Globe,
  BarChart3,
  TrendingUp,
  PieChart,
  LineChart,
  Layers,
  Shield,
  KeyRound,
  Activity,
  HardHat,
  Smartphone,
  Camera,
  Laptop,
  Tablet,
  Settings,
  Bell,
  SlidersHorizontal,
  Building2,
  Sparkles,
  Check,
  Plug,
  type LucideIcon,
} from "lucide-react";

// -----------------------------------------------------------------------------
// Data — every feature listed here is grounded in the actual product code or
// user manual. Do not add "planned" features. If you remove one from the app,
// remove it from here.
// -----------------------------------------------------------------------------

type Feature = {
  icon: LucideIcon;
  title: string;
  desc: string;
  badge?: string;
};

type CapabilityBucket = {
  id: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  features: Feature[];
};

const spotlightFeatures: Feature[] = [
  {
    icon: ScanLine,
    title: "Barcode scan → Discogs auto-match",
    desc: "Point your phone camera at any record barcode. Vinylogix matches it against the Discogs catalogue and pre-fills artist, title, cover art, tracklist, year, label, and format — in one tap. Hardware USB/Bluetooth scanners work too.",
  },
  {
    icon: Store,
    title: "Branded storefront with access control",
    desc: "A public catalogue under your own name and logo. Flip between open, private, or invite-only. Wholesale prices stay invisible to the outside world; invited record shops see exactly what you want them to see.",
  },
  {
    icon: CreditCard,
    title: "Stripe Connect + PayPal, PCI-free",
    desc: "Card data never touches your server. Stripe Connect handles payouts, refunds, invoicing, and compliance. PayPal works as an alternative checkout. Buyers pay, you get paid, nothing else to worry about.",
  },
  {
    icon: Warehouse,
    title: "Multi-location inventory",
    desc: "Separate stock counts for shop floor and backroom storage — with custom location names per distributor. Know exactly where every record lives before a sale, not after a customer walks up to the counter.",
  },
  {
    icon: Bot,
    title: "AI cover recognition + AI descriptions",
    desc: "No barcode? Snap a photo of the cover and let AI identify the release. On Scale, generate rich artist bios and album summaries automatically. The boring part of cataloguing, handled.",
    badge: "Scale tier",
  },
  {
    icon: Shield,
    title: "Team roles with granular permissions",
    desc: "Four roles (Master, Worker, Viewer, Superadmin) plus seven worker-level permissions. Lock down purchasing prices, supplier edits, and order fulfilment per staff member. No accidental price drops.",
  },
];

const capabilityBuckets: CapabilityBucket[] = [
  {
    id: "inventory",
    icon: Package,
    title: "Inventory & catalogue management",
    subtitle:
      "Everything you need to get records into the system fast, keep them organised, and know exactly what you have at any moment.",
    features: [
      {
        icon: ScanLine,
        title: "Phone & hardware barcode scanning",
        desc: "UPC-A and EAN-13 recognition with the phone camera. USB/Bluetooth HID-mode scanners for rapid-fire batch entry.",
      },
      {
        icon: Disc3,
        title: "Discogs catalogue enrichment",
        desc: "Artist, title, tracklist, cover art, year, label, country, format, genre, style — all pulled in one API call.",
      },
      {
        icon: Bot,
        title: "AI cover recognition",
        desc: "When the barcode is worn or missing, snap a photo of the sleeve. AI identifies the release.",
      },
      {
        icon: Layers,
        title: "8-point Goldmine grading",
        desc: "Industry-standard condition scale (M / NM / VG+ / VG / G+ / G / F / P) for media and sleeve independently.",
      },
      {
        icon: Warehouse,
        title: "Shelf vs storage stock",
        desc: "Dual stock counts per record, with custom location names. Know which copies are out on the floor.",
      },
      {
        icon: TableProperties,
        title: "Bulk operations",
        desc: "Update prices by flat amount, percentage, or target margin. Move records between locations. Export selected to CSV.",
      },
      {
        icon: Weight,
        title: "Weight-based shipping templates",
        desc: "Preset options for single LP, 180g LP, double LP, 7-inch, CD — plus custom per-record override.",
      },
      {
        icon: TrendingUp,
        title: "Aging & dead stock reports",
        desc: "Identify records sitting unsold for 90+ days, and see inventory value broken down by location.",
      },
    ],
  },
  {
    id: "storefront",
    icon: Store,
    title: "Branded storefront & client experience",
    subtitle:
      "Your public face. A custom-branded catalogue that feels like your shop, not a marketplace you rent.",
    features: [
      {
        icon: Palette,
        title: "Custom branding",
        desc: "Logo, company name, headline, and description on a unique public URL — yourname at vinylogix.com.",
      },
      {
        icon: Eye,
        title: "Three visibility modes",
        desc: "Open (public catalogue), private (hidden from search), or invite-only (buyers must be approved first).",
      },
      {
        icon: SlidersHorizontal,
        title: "Card display customisation",
        desc: "Toggle 8 fields (title, artist, year, country, stock locations, format) independently per storefront.",
      },
      {
        icon: Sparkles,
        title: "Featured records carousel",
        desc: "Manually hand-pick which releases land at the top of your catalogue for new visitors and campaigns.",
      },
      {
        icon: UserPlus,
        title: "Client invitations",
        desc: "Email invites with 7-day expiring links, custom welcome text, resend flow, and one-click revoke.",
      },
      {
        icon: Users,
        title: "Client CRM + insights",
        desc: "Per-client history, lifetime value, genre preferences, and activity status. See who buys what, and how often.",
      },
      {
        icon: Heart,
        title: "Client wishlist & favourites",
        desc: "Clients can save records for later and mark favourites. You see what they want before they ask.",
      },
      {
        icon: Bell,
        title: "Access requests",
        desc: "Visitors can request access to private catalogues. You approve or decline from the dashboard.",
      },
    ],
  },
  {
    id: "orders",
    icon: ShoppingCart,
    title: "Orders & fulfilment",
    subtitle:
      "From cart to front door. Every status, every carrier, every refund — handled inside Vinylogix with zero spreadsheets.",
    features: [
      {
        icon: ShoppingCart,
        title: "Integrated cart & checkout",
        desc: "Buyers browse your catalogue, add to cart, and check out without ever leaving your branded storefront.",
      },
      {
        icon: Clock,
        title: "Eight order statuses",
        desc: "Awaiting approval → pending → awaiting payment → paid → processing → shipped → completed (+ on hold, cancelled).",
      },
      {
        icon: Truck,
        title: "Seven carrier integrations",
        desc: "PostNL, DHL, UPS, FedEx, DPD, GLS, Correos — with automatic tracking link generation per carrier.",
      },
      {
        icon: RefreshCw,
        title: "Partial refunds + stock restore",
        desc: "Refund a line or a whole order with a reason. Inventory automatically goes back on the shelf.",
      },
      {
        icon: Map,
        title: "Weight-based shipping zones",
        desc: "Define multiple zones (domestic / EU / international) with tiered weight-range pricing per zone.",
      },
      {
        icon: MapPin,
        title: "Local pickup option",
        desc: "Let buyers skip shipping entirely and collect in store. Configurable per storefront.",
      },
      {
        icon: FileText,
        title: "Order approval + payment links",
        desc: "Hold orders for manual approval. Generate expiring payment links for orders awaiting payment.",
      },
      {
        icon: Bell,
        title: "Status notifications",
        desc: "Automatic buyer emails at each status change. In-app notifications for you, configurable per event.",
      },
    ],
  },
  {
    id: "payments",
    icon: CreditCard,
    title: "Payments, invoicing & tax",
    subtitle:
      "Get paid without the PCI nightmare. Auto-invoicing with all the compliance bits European B2B actually needs.",
    features: [
      {
        icon: CreditCard,
        title: "Stripe Connect",
        desc: "Card processing, merchant payouts, refunds, and chargebacks. Card data never touches Vinylogix servers.",
      },
      {
        icon: Wallet,
        title: "PayPal Commerce Platform",
        desc: "Alternative checkout for buyers who prefer PayPal. Works alongside Stripe on the same storefront.",
      },
      {
        icon: Receipt,
        title: "Auto-invoicing with custom text",
        desc: "Invoices generate automatically per order. Customise footer, payment terms, notes, and whether bank details show.",
      },
      {
        icon: Calculator,
        title: "Three tax modes",
        desc: "None, manual fixed-rate (any label), or Stripe Tax for automated multi-jurisdiction VAT calculation.",
      },
      {
        icon: Globe,
        title: "EU B2B compliance",
        desc: "VIES VAT validation with company-name lookup, reverse charge on intra-EU B2B, and EORI number storage.",
      },
      {
        icon: Building2,
        title: "Multiple payment accounts",
        desc: "Label separate bank or PayPal accounts (e.g. \"Main Business\", \"PayPal Sales\") for different invoice contexts.",
      },
    ],
  },
  {
    id: "analytics",
    icon: BarChart3,
    title: "Analytics & insights",
    subtitle:
      "Know what's selling, what's sitting, and who your best buyers are — without opening a spreadsheet.",
    features: [
      {
        icon: LineChart,
        title: "Revenue trends",
        desc: "Chart revenue and order volume over 7/30/90 days, year-to-date, or a custom range.",
      },
      {
        icon: TrendingUp,
        title: "Top sellers",
        desc: "Highest-revenue records with attribution by genre, format, and condition.",
      },
      {
        icon: PieChart,
        title: "Genre & format breakdowns",
        desc: "See where your revenue actually comes from — LPs vs 7\" vs CDs, rock vs jazz vs electronic.",
      },
      {
        icon: Users,
        title: "Client insights",
        desc: "Lifetime value, average order value, purchase frequency, retention rate, top customers.",
      },
      {
        icon: Package,
        title: "Inventory valuation",
        desc: "Total stock value at selling price, broken down by location. Turnover and aging metrics.",
      },
      {
        icon: FileText,
        title: "Exports",
        desc: "PDF reports, CSV for spreadsheet analysis, chart images for presentations and sharing.",
      },
    ],
  },
  {
    id: "team",
    icon: Shield,
    title: "Team, roles & activity log",
    subtitle:
      "Give staff the right level of access. Track every change. Audit trail built in, not bolted on.",
    features: [
      {
        icon: HardHat,
        title: "Four role levels",
        desc: "Master (owner, full control), Worker (staff with custom permissions), Viewer (clients), Superadmin (platform).",
      },
      {
        icon: KeyRound,
        title: "Seven worker permissions",
        desc: "View/edit purchasing prices, view/edit selling prices, edit suppliers, manage orders, manage locations.",
      },
      {
        icon: UserPlus,
        title: "Staff invitations",
        desc: "Email-based invites with instant access suspension if needed. No re-onboarding required.",
      },
      {
        icon: Activity,
        title: "Activity audit log",
        desc: "Eleven tracked event types — sessions, record edits, order placements, settings changes — with user email and timestamp.",
      },
    ],
  },
  {
    id: "mobile",
    icon: Smartphone,
    title: "Mobile, tablet & scanning",
    subtitle:
      "The platform follows you around. Scan on the shop floor, manage orders from the couch, run the counter from a tablet.",
    features: [
      {
        icon: Camera,
        title: "Phone camera scanning",
        desc: "UPC-A and EAN-13 barcode detection with visual feedback and automatic Discogs lookup.",
      },
      {
        icon: ScanLine,
        title: "Hardware scanner support",
        desc: "USB and Bluetooth scanners in HID mode with a dedicated scanner input that auto-processes on Enter.",
      },
      {
        icon: Laptop,
        title: "Fullscreen scan mode",
        desc: "Dedicated workstation view for high-volume cataloguing sessions. Minimal UI, maximum throughput.",
      },
      {
        icon: Tablet,
        title: "Responsive on every device",
        desc: "Desktop power for deep analytics, tablet UX for point-of-sale, mobile efficiency for on-the-go updates.",
      },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    title: "Settings & administration",
    subtitle:
      "Everything you'd expect a grown-up platform to ship with — configurable, not hardcoded.",
    features: [
      {
        icon: Building2,
        title: "Business & legal info",
        desc: "Company details, VAT number, EORI, KVK / Chamber of Commerce, Tax ID — all validated where possible.",
      },
      {
        icon: Bell,
        title: "Low-stock alerts",
        desc: "Per-distributor threshold and opt-in notifications. Get a ping when a record drops below your limit.",
      },
      {
        icon: MapPin,
        title: "Custom location names",
        desc: "Define the shelves and storage areas that match your physical shop layout. Not just \"A1 / B2\".",
      },
      {
        icon: Truck,
        title: "Shipping zones & thresholds",
        desc: "Multiple zones, weight tiers, free-shipping thresholds, pickup option — all editable per storefront.",
      },
      {
        icon: Calculator,
        title: "Tax configuration",
        desc: "Pick between no tax, fixed manual rates, or automated Stripe Tax. Reverse charge and VIES handled.",
      },
      {
        icon: Bell,
        title: "Notification preferences",
        desc: "Five notification types (orders, updates, low stock, client activity, system) × delivery × frequency.",
      },
    ],
  },
];

const platformStats = [
  { stat: "8", label: "Goldmine condition grades" },
  { stat: "8", label: "Order statuses tracked" },
  { stat: "6", label: "Shipping carriers integrated" },
  { stat: "7", label: "Granular worker permissions" },
  { stat: "11", label: "Activity log event types" },
  { stat: "3", label: "Tax modes (none / manual / Stripe Tax)" },
];

// -----------------------------------------------------------------------------
// Sub-components
// -----------------------------------------------------------------------------

function SpotlightCard({ feature, isHighlight }: { feature: Feature; isHighlight?: boolean }) {
  const Icon = feature.icon;
  return (
    <div
      className={
        isHighlight
          ? "relative flex h-full flex-col rounded-2xl border border-primary/30 bg-primary/[0.03] p-6 sm:p-8 ring-1 ring-primary/20 shadow-xl shadow-primary/10"
          : "relative flex h-full flex-col rounded-2xl border bg-card p-6 sm:p-8 transition-all hover:border-primary/30 hover:shadow-lg"
      }
    >
      {feature.badge && (
        <span className="absolute -top-3 right-6 inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-lg">
          {feature.badge}
        </span>
      )}
      <div className="rounded-full bg-primary/10 p-3 w-fit mb-5">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-xl font-semibold">{feature.title}</h3>
      <p className="mt-3 text-sm text-muted-foreground leading-relaxed flex-1">{feature.desc}</p>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <div className="group flex gap-4 rounded-xl border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-md">
      <div className="rounded-lg bg-primary/10 p-2.5 w-fit h-fit shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-foreground leading-tight">{feature.title}</h4>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
      </div>
    </div>
  );
}

function CapabilitySection({ bucket }: { bucket: CapabilityBucket }) {
  const Icon = bucket.icon;
  return (
    <section id={bucket.id} className="py-16 sm:py-20 border-t scroll-mt-24">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 p-2.5 mb-4">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{bucket.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground leading-relaxed">
            {bucket.subtitle}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
          {bucket.features.map((f) => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function FeaturesPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden pt-28 pb-8 md:pt-36 md:pb-12">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_70%)]" />
        </div>
        <div className="container relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Sparkles className="h-4 w-4" />
            Every feature in the platform
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Everything you need to run
            <br className="hidden sm:block" /> a vinyl business
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Inventory, storefront, orders, payments, analytics, team roles, and
            every setting in between. Fifty-plus features, designed
            specifically for vinyl distributors and record stores — not
            retrofitted from generic e-commerce.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="shadow-lg shadow-primary/20">
              <Link href="/get-started">
                Start free trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Quick-jump anchor nav */}
      <section className="py-6 border-t bg-muted/20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-2">
              Jump to
            </span>
            {capabilityBuckets.map((b) => (
              <Link
                key={b.id}
                href={`#${b.id}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
              >
                <b.icon className="h-3.5 w-3.5" />
                {b.title.split(" ")[0]}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Spotlight — 6 flagship features */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Six features that make the biggest difference
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
              If you only look at a few things, look at these. Everything else
              scales with your shop.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {spotlightFeatures.map((f, i) => (
              <SpotlightCard key={f.title} feature={f} isHighlight={i === 1} />
            ))}
          </div>
        </div>
      </section>

      {/* Capability buckets */}
      {capabilityBuckets.map((bucket) => (
        <CapabilitySection key={bucket.id} bucket={bucket} />
      ))}

      {/* Multi-device section (uses existing product image) */}
      <section className="py-16 sm:py-24 border-t">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid gap-12 lg:grid-cols-2 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 p-2.5 mb-4">
                <Laptop className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Desktop, tablet, phone — same platform
              </h2>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Vinylogix is a single responsive web app. Nothing to install,
                nothing to sync. The desktop view gives you the full command
                centre for analytics and bulk edits. The tablet view turns into
                a mobile point-of-sale. The phone view is your pocket scanner
                and order-status checker.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Full-featured dashboard on desktop — analytics, bulk ops, admin",
                  "Tablet UX tuned for the shop counter and trade-fair POS",
                  "Mobile barcode scanning + on-the-go order checks",
                  "Single account, single login, one source of truth",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground/80">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Image
                src="/Devices_invent.png"
                alt="Vinylogix running on desktop, tablet and phone"
                width={600}
                height={450}
                style={{ width: "100%", height: "auto" }}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip — the specific, countable facts */}
      <section className="py-16 sm:py-20 border-t border-b bg-muted/20">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              The specifics
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Concrete things the platform ships with, counted. Not marketing fluff.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6 text-center">
            {platformStats.map((item) => (
              <div key={item.label}>
                <p className="text-4xl font-bold tracking-tight text-primary">
                  {item.stat}
                </p>
                <p className="mt-2 text-xs text-muted-foreground leading-snug">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tier callout */}
      <section className="py-16 sm:py-20 border-t">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-8 sm:p-10">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto] items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-3">
                  <Sparkles className="h-3 w-3" />
                  Features scale with your plan
                </div>
                <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Start free, grow into it
                </h3>
                <p className="mt-3 text-muted-foreground leading-relaxed max-w-2xl">
                  Pay-as-you-go is free forever with up to 50 records and a 6%
                  transaction fee. Scale unlocks unlimited records, unlimited
                  users, AI-powered descriptions, advanced analytics, and a 2%
                  transaction fee. Every paid plan includes a 7-day free trial.
                </p>
              </div>
              <Button asChild size="lg">
                <Link href="/pricing">
                  Compare plans
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations callout */}
      <section className="py-16 sm:py-20 border-t">
        <div className="container mx-auto max-w-5xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 p-2.5 mb-4">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Works with Discogs, Stripe, PayPal and the carriers you already use
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            No middleware, no plugins. Every integration is wired directly into
            the platform. See exactly what they do and how they connect.
          </p>
          <div className="mt-8">
            <Button asChild variant="outline" size="lg">
              <Link href="/integrations">
                See all integrations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 bg-muted/30 border-t">
        <div className="container mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Ready to see the platform in action?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Start with Pay-as-you-go for free, or try any paid plan free for 7
            days. No credit card required on the free tier.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/get-started">
                Get started free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

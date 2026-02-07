"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Search, HelpCircle, Disc3, Users, CreditCard, ShieldCheck, Mail, MessageCircle } from "lucide-react";
import { Header, Footer } from "@/components/landing";

const faqCategories = [
  {
    id: "general",
    title: "General",
    icon: HelpCircle,
    questions: [
      {
        q: "What is Vinylogix?",
        a: "Vinylogix is a B2B platform designed for vinyl record distributors and record stores. It helps distributors manage their inventory, process orders, and connect with record store buyers. For collectors, it offers tools to manage personal collections and purchase from local distributors."
      },
      {
        q: "Who is Vinylogix for?",
        a: "Vinylogix serves two main audiences: (1) Vinyl distributors and wholesalers who want to manage inventory and sell to record stores, and (2) Record store owners and collectors who want to browse catalogs and place orders from their suppliers."
      },
      {
        q: "How is Vinylogix different from Discogs?",
        a: "Discogs is primarily a B2C marketplace where sellers list individual records for collectors. Vinylogix is a B2B platform focused on wholesale relationships between distributors and record stores. Think of Discogs as retail, and Vinylogix as wholesale. Many distributors use both: Discogs for individual collector sales, and Vinylogix for bulk orders to record stores."
      },
    ]
  },
  {
    id: "discogs",
    title: "Discogs Integration",
    icon: Disc3,
    questions: [
      {
        q: "Can I use Vinylogix if my inventory is on Discogs?",
        a: "Yes! Many distributors use both platforms for different purposes. The key is to understand they serve different markets: Discogs for B2C (collectors, retail prices), Vinylogix for B2B (record stores, wholesale prices). You can have the same records on both platforms with different pricing strategies."
      },
      {
        q: "Does Vinylogix sync with Discogs?",
        a: "Vinylogix can pull catalog information from Discogs (artist, title, cover art, tracklist) to help you quickly add records. However, this is for catalog data only - your Vinylogix inventory and pricing are managed separately from your Discogs marketplace listings."
      },
      {
        q: "Will using Vinylogix violate Discogs' terms of service?",
        a: "No, as long as you use them for their intended purposes. Discogs prohibits redirecting their marketplace customers to external payment platforms. With Vinylogix, you're reaching a completely different audience (B2B record stores) through a separate platform. Your Discogs listings remain for collectors, while Vinylogix serves wholesale buyers."
      },
      {
        q: "How should I price items on both platforms?",
        a: "Most distributors use retail pricing on Discogs (for collectors) and wholesale/bulk pricing on Vinylogix (for record stores). This way, both platforms serve their intended markets without conflict. Record stores expect lower prices for bulk orders, while collectors on Discogs pay retail."
      },
    ]
  },
  {
    id: "accounts",
    title: "Accounts & Roles",
    icon: Users,
    questions: [
      {
        q: "What user roles are available?",
        a: "Vinylogix has several roles: Master (distributor owner with full access), Worker (staff with customizable permissions), and Viewer/Client (record store buyers who can browse and order). Each role has specific capabilities tailored to their needs."
      },
      {
        q: "Can I have multiple staff members?",
        a: "Yes! As a Master user, you can invite Workers to help manage your inventory and orders. You control their permissions - for example, some workers can view but not edit prices, while others have full access."
      },
      {
        q: "How do I invite clients to my catalog?",
        a: "From your dashboard, go to the Clients section and use the invite feature. Clients will receive an email invitation to create an account. Once registered, they can browse your catalog and place orders."
      },
    ]
  },
  {
    id: "billing",
    title: "Billing & Payments",
    icon: CreditCard,
    questions: [
      {
        q: "How does payment processing work?",
        a: "Vinylogix supports Stripe and PayPal for payment processing. When your clients place orders, payments are processed through your connected payment account. A small platform fee (4%) is deducted, and the rest goes directly to you."
      },
      {
        q: "What are the payment processing fees?",
        a: "We use Stripe for secure payment processing. As of January 2025, Stripe's fees for the European Economic Area (EEA) are: Standard EEA cards: 1.5% + €0.25, Premium EEA cards: 1.9% + €0.25, UK cards: 2.5% + €0.25, and International cards: 3.25% + €0.25 (plus 2% if currency conversion is required). These fees are charged by Stripe, not Vinylogix. For the most up-to-date rates, please visit stripe.com/pricing. Additionally, Vinylogix charges a 4% platform fee on the item price to support the platform and its features."
      },
      {
        q: "What is the Stripe onboarding process?",
        a: "Connecting your Stripe account is quick and secure. Here's what to expect: 1) Click 'Connect Stripe' in your Settings, 2) You'll be redirected to Stripe's secure onboarding page, 3) Provide your business information (business name, address, type), 4) Enter your personal details for identity verification (name, date of birth, last 4 digits of your ID), 5) Add your bank account details for payouts, 6) Verify your email and phone number. The entire process typically takes 5-10 minutes. Stripe may request additional documentation for verification."
      },
      {
        q: "Why does Stripe require identity verification (KYC)?",
        a: "Stripe's Know Your Customer (KYC) requirements are in place to protect you, your customers, and the integrity of the payment system. This verification helps prevent fraud and money laundering, ensures compliance with financial regulations, protects your business from chargebacks and disputes, and builds trust with your customers. Stripe is a globally trusted payment processor used by millions of businesses, including Amazon, Google, and Shopify. Your data is encrypted and handled according to the highest security standards. This verification is a one-time process that enables you to accept payments securely."
      },
      {
        q: "What is the PayPal onboarding process?",
        a: "Connecting your PayPal account is straightforward. Here's what to expect: 1) Click 'Connect PayPal' in your Settings, 2) You'll be redirected to PayPal's secure authorization page, 3) Log in to your existing PayPal Business account (or create one), 4) Grant Vinylogix permission to process payments on your behalf, 5) Confirm your business details and bank account for payouts, 6) Complete PayPal's verification if required. PayPal may require additional documentation for new business accounts. Once connected, you can accept PayPal payments from customers worldwide."
      },
      {
        q: "Why should I connect a payment provider?",
        a: "Connecting Stripe or PayPal allows your clients to pay directly through Vinylogix, making the ordering process seamless. Payments go directly to your account (minus fees), orders are automatically marked as paid, and you get a professional checkout experience. Without a connected payment provider, you would need to handle payments manually outside the platform."
      },
      {
        q: "What are the subscription plans?",
        a: "We offer tiered subscription plans based on your needs. Visit our Pricing page for current plans and features. All plans include a free trial period so you can explore the platform before committing."
      },
    ]
  },
  {
    id: "security",
    title: "Security & Privacy",
    icon: ShieldCheck,
    questions: [
      {
        q: "Is my data secure?",
        a: "Yes. Vinylogix uses industry-standard security practices including encrypted connections (HTTPS), secure authentication, and trusted payment processors (Stripe/PayPal). We never store your payment card details directly."
      },
      {
        q: "Who can see my inventory and pricing?",
        a: "Only clients you've invited can see your catalog. Your purchasing prices and supplier information are never visible to clients - they only see selling prices. You control who has access to your distributor environment."
      },
      {
        q: "Can I export my data?",
        a: "Yes, you can export your inventory data at any time. We believe your data belongs to you, and we make it easy to download your records, orders, and client information."
      },
    ]
  },
];

const contactOptions = [
  {
    icon: Mail,
    title: "Email Support",
    description: "Get help via email within 24-48 hours",
    action: "support@vinylogix.com",
    href: "mailto:support@vinylogix.com",
  },
  {
    icon: MessageCircle,
    title: "Community",
    description: "Join our community of vinyl enthusiasts",
    action: "Coming Soon",
    href: "#",
    disabled: true,
  },
];

export default function HelpPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredCategories = faqCategories.map(category => ({
    ...category,
    questions: category.questions.filter(
      q =>
        q.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.a.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 pt-28 pb-12 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-primary mb-4">Help Center</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions about Vinylogix. Can't find what you're looking for? Contact our support team.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-xl mx-auto mb-12">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search for answers..."
            className="pl-10 h-12 text-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* FAQ Categories */}
        <div className="space-y-8 mb-16">
          {(searchTerm ? filteredCategories : faqCategories).map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <category.icon className="h-6 w-6 text-primary" />
                  {category.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((item, index) => (
                    <AccordionItem key={index} value={`${category.id}-${index}`}>
                      <AccordionTrigger className="text-left">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}

          {searchTerm && filteredCategories.length === 0 && (
            <div className="text-center py-12">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground">
                Try different keywords or contact support for help.
              </p>
            </div>
          )}
        </div>

        {/* Contact Section */}
        <div className="border-t pt-12">
          <h2 className="text-2xl font-bold text-center mb-8">Still need help?</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {contactOptions.map((option) => (
              <Card key={option.title} className={option.disabled ? "opacity-60" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <option.icon className="h-5 w-5 text-primary" />
                    {option.title}
                  </CardTitle>
                  <CardDescription>{option.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {option.disabled ? (
                    <span className="text-sm text-muted-foreground">{option.action}</span>
                  ) : (
                    <Button variant="outline" asChild>
                      <a href={option.href}>{option.action}</a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

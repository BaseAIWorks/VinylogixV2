#!/usr/bin/env node
/**
 * Changelog entries for 2026-04-16 — invoice accuracy, stock reservation,
 * discount feature, mark-as-paid, Stripe hardening, settings restructure,
 * platform fee overrides, cart VAT, client business profile.
 *
 * Usage: node scripts/add-changelog-2026-04-16.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('/Users/saliano/VibeWorks/Vinylogix/docs/vinylogix-v1-firebase-adminsdk-fbsvc-5fb9a73b67.json', 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const changelogEntries = [
  {
    version: "2.19.0",
    title: "Stock Reservation & Oversell Protection",
    notes: `Physical inventory and open-order reservations are now tracked separately so two customers can't claim the same copy at the same time:

## Reservation-Aware Stock

- **New "Reserved" column** alongside physical stock — the count held by open orders (awaiting_approval / awaiting_payment)
- **"Available for sale"** is shown on record pages and the inventory table, computed as physical − reserved
- **Storefront & cart** display availability based on what's actually purchasable, not raw warehouse count
- **Low-stock notifications** now trigger on available (not physical) so alerts reflect what customers still see

## Atomic Operations

- **Race condition fixed** — simultaneous orders can no longer both claim the last copy; stock operations now run as per-record Firestore transactions
- **Duplicate-line-item protection** — quantities are coalesced per record before any stock math, preventing self-races within a single order
- **Reservation rollback** — if an order fails to save after stock was reserved, the reservation is released automatically

## Order Lifecycle

- **Reserve on create** — Request Orders and direct storefront checkouts hold stock immediately
- **Release on cancel/reject** — pre-payment cancellations return the reserved stock
- **Deduct on paid** — the reservation is converted to a real stock decrease only once payment is confirmed
- **Restore on refund** — refunding a paid order puts stock back`,
    createdAt: new Date('2026-04-16T09:00:00Z'),
  },

  {
    version: "2.20.0",
    title: "Invoice Accuracy: Adjustments Now Reflected Everywhere",
    notes: `Items the distributor marks as Not Available or Out of Stock, plus any quantity changes, now flow through to every customer-facing surface:

## Invoice PDF

- **Filtered line items** — unavailable and out-of-stock items no longer appear on the downloaded invoice
- **Item count** at the bottom of the PDF reflects the billable quantity only
- **Discount line** shows between subtotal and shipping when a discount is applied

## Customer Emails

- **Order confirmation, approval, and payment emails** all filter to billable items — matches the totals shown in the same email
- **Shipping row logic** improved — shows actual amount, "Free" only when the distributor's shipping calc really triggered free shipping, and "Pickup (no shipping)" for pickup orders

## Client Pages

- **/my-orders/[id]** shows the same breakdown a distributor sees — Subtotal → Discount → Shipping → VAT → Total in a consistent order
- **Admin revenue detail** now includes the Discount row too, so finance reviews match invoice amounts`,
    createdAt: new Date('2026-04-16T10:00:00Z'),
  },

  {
    version: "2.21.0",
    title: "Order Discount (Fixed Amount or Percent)",
    notes: `Apply a discount to any open order and have it flow cleanly through tax, invoice and payment:

## New Pricing Card

- **Side-panel card** between Order Status and Customer on the order detail page (master-only, open orders only)
- **Discount toggle** — default off. When on: switch between "Fixed amount" (€) and "Percent" (%) with the correct input adornment
- **Shipping toggle** — same pattern, auto-on when an existing shipping cost is stored
- **Auto-capped** — fixed discounts can't exceed items subtotal; percentages clamp at 100%

## Recalculate Price + Tax

- **Single button** replaces the separate "Recalculate Tax" action and inline shipping save
- **One atomic update** — item status, discount, shipping and tax all committed together
- **Historical tax rate** preserved — recalc uses the rate stored on the order, never overwrites it with the distributor's current setting

## Safety Interlock

- **Pricing-dirty banner** — amber notice appears when changes are pending
- **Send actions disabled** — Email Invoice, Regenerate Payment Link, Approve, Mark as Paid, and Notify Client all gate on "Recalculate first" so invoices never go out with stale totals

## Invoice & Emails

- **New Discount row** on the invoice PDF, approval emails, updated-link emails, my-orders page and admin revenue detail
- **Label matches input** — "Discount (10%)" for percent or just "Discount" for fixed, amount in green with a leading minus`,
    createdAt: new Date('2026-04-16T11:00:00Z'),
  },

  {
    version: "2.22.0",
    title: "Redesigned Customer Emails with Invoice PDF Attached",
    notes: `Every customer-facing order email now looks professional and carries the up-to-date invoice:

## Branded Template

- **Distributor logo or company name** in the header — clearly coming from the seller, not from Vinylogix
- **Colored accent strip** identifies the distributor at a glance
- **Clean items table** with artist, title, quantity, unit price and line total
- **Full totals breakdown** — Subtotal → Discount → Shipping → VAT → Total with reverse-charge notes where applicable
- **Contact footer** with the distributor's email, phone and website

## Applied to Every Customer Email

- **Order Approved & Pay Now** — when Stripe link is sent, now includes the invoice PDF as attachment
- **Approve & Send Invoice Only** — payment terms + bank/IBAN details shown inline with "include order # as reference" guidance
- **Updated Payment Link** — amber "use this new link" callout; earlier link is clearly marked invalid
- **Updated Invoice** — used when a distributor resends after edits
- **Payment Received** — green "✓ Paid via <method>" pill badge for manual payments

## Server-Side Invoice Generation

- **Invoice PDF is generated by the server** from Firestore data for the email flow — no longer depends on the browser and is immune to client-side tampering
- **New "Email Invoice" button** next to Download Invoice — sends the PDF directly to the customer in one click
- **Timestamp tracking** — the order shows when the invoice was last emailed and how many times`,
    createdAt: new Date('2026-04-16T12:00:00Z'),
  },

  {
    version: "2.23.0",
    title: "Mark as Paid: Dialog for Bank Transfer & External Payments",
    notes: `Manual payments (bank transfer, cash, external PayPal/Stripe) now have the same quality of record as Stripe-captured payments:

## Dialog on Mark as Paid

- **Payment method** — Bank transfer, Cash, PayPal (direct), Stripe (outside), or Other
- **Reference** (optional) — bank transaction ID, memo, etc. for your records
- **Internal notes** (optional, up to 1000 chars) — only visible to your team
- **Email toggle** — send a "Payment Received" confirmation to the customer (default on)

## Proper Audit Trail

- **paidAt** timestamp set automatically
- **paidBy** records which operator clicked the button
- **paymentMethod / paymentReference / paymentNotes** stored on the order
- **Stripe session expired** — any still-open payment link is auto-closed via stripe.checkout.sessions.expire so the customer can't accidentally pay twice
- **Stock deducted atomically** in the same transaction`,
    createdAt: new Date('2026-04-16T13:00:00Z'),
  },

  {
    version: "2.24.0",
    title: "Stripe Payment Link: Regenerate, Stale Detection, Shipping Included",
    notes: `The Stripe payment-link lifecycle now handles the real-world cases where item changes happen after approval:

## Stripe Line Items Include Shipping

- **Shipping is now a real line item** on the Stripe checkout session — previously only products were charged and shipping silently went missing from Stripe, triggering amount-mismatch flags
- **Zone label** included so the customer sees "Shipping (NL)" on Stripe
- **Stripe Tax mode** uses the correct txcd_92010001 shipping tax category

## Stale Link Detection

- **New Payment Link card** on the order — green "Active", amber "Out of date" or muted "Expired"
- **Copy-to-clipboard** for the current link with visible expiry time
- **"Items changed since link was created"** warning when the order was edited after the link was generated
- **Confirm dialog** when saving item changes with an active link, so you remember to regenerate

## Regenerate Flow

- **One-click Regenerate Payment Link** — expires the old Stripe session automatically, creates a new session with the current items, and optionally emails the customer with the new link
- **Dedicated "Updated Payment Link" email** — amber warning tells the customer any earlier link is no longer valid
- **Invoice PDF attached** to the regeneration email

## Webhook Validation

- **Amount-mismatch detection** — when Stripe captures a different amount than the current order total (e.g. customer paid a stale link), the order is flagged with a red "Payment Amount Mismatch" card showing both amounts and moved to on_hold
- **Double-payment detection** — if the order was already marked paid via another method and Stripe webhook fires later, the duplicate is flagged rather than overwriting`,
    createdAt: new Date('2026-04-16T14:00:00Z'),
  },

  {
    version: "2.25.0",
    title: "Payment Tab in Settings + Online-Checkout Opt-Out",
    notes: `Business settings are reorganized around how your customers pay, and Scale/Managed distributors can now opt out of Stripe entirely:

## New Payment Tab

- **All payment-related settings in one place** — separated from the Business tab
- **Payment Providers** (Stripe Connect + PayPal), **Order Settings** (Allow Order Requests, payment-link mode), **Tax/VAT**, and **Invoice Settings** (payment terms, bank accounts) all live here
- **Wider layout** — Settings container grew from max-w-4xl to max-w-6xl so multi-column cards don't feel cramped
- **PayPal greyed out** with "Coming soon" badge — the integration isn't yet wired end-to-end

## Payment-Link Mode

- **New distributor setting** with three options:
  - *Always send Stripe payment link* (default, current behaviour)
  - *Ask per order at approval*
  - *Never — always invoice-only*
- **Order approval UI** adapts — you see either one button ("Approve & Send Payment Link"), both side by side, or just "Approve & Send Invoice Only" depending on the mode

## Disable Stripe Entirely (Scale / Managed)

- **Online-checkout toggle** in the Payment tab, only visible on Scale-tier or managed-account distributors
- **When off**: the storefront shows only "Request Order" — no Stripe / PayPal at checkout
- **Invoice-only flow becomes the only approval path** — customer pays externally, you mark-as-paid when funds arrive
- **Backend guards** on every Stripe endpoint reject requests once disabled, as defense-in-depth`,
    createdAt: new Date('2026-04-16T15:00:00Z'),
  },

  {
    version: "2.26.0",
    title: "Platform Fee Override + Per-Distributor Revenue Breakdown",
    notes: `Superadmin gets finer control over platform economics and more detailed revenue visibility:

## Custom Platform Fee per Distributor

- **New superadmin-only field** on each distributor: Platform Fee Override (range 0.0% – 6%)
- **Overrides the tier default** — Scale defaults to 2% but can be set to 1% or 0% for a specific wholesale partner
- **Amber "X% (custom)" badge** on the distributor detail page shows when an override is active
- **Applies to new orders only** — historical orders keep the rate they recorded at creation, so reporting stays consistent
- **Locked down via Firestore rule** — masters cannot edit this field on their own distributor, only a superadmin can

## Revenue by Distributor

- **New table on /admin/revenue** — revenue, platform fees, payout and paid-order count grouped per distributor
- **Refunded orders** are excluded from revenue / fee totals (the application_fee is returned by Stripe on refund)
- **Refund count** surfaced in the header so you can spot anomalies
- **Applied fee percentage** is now persisted on every Stripe session creation — future tier changes don't erase historical rate visibility`,
    createdAt: new Date('2026-04-16T16:00:00Z'),
  },

  {
    version: "2.27.0",
    title: "Cart VAT Clarity + Reverse-Charge Detection",
    notes: `The cart page no longer shows a bare "+ VAT 21%" label — customers see an accurate, real-time breakdown:

## Proper Breakdown Before Checkout

- **Subtotal excl. VAT / VAT (rate) / Total** shown on the cart summary for manual-tax distributors
- **Stripe Tax mode** displays "VAT and shipping are calculated at checkout based on your delivery address"
- **Inclusive pricing** handled correctly — subtotal excl. VAT is derived from the inclusive item prices

## EU Reverse Charge

- **Cart detects** when the customer has an EU VAT number in a different country than the distributor
- **Shows 0% VAT** with a "Reverse charge" label and an italic note: "VAT to be accounted for by the recipient (intra-EU reverse charge)"
- **Unverified VAT hint** — when a VAT number is present but not yet VIES-verified, an amber hint prompts the client to verify so reverse-charge applies on the final invoice
- **Legal gating on the backend** — orders only apply reverse charge when the VAT number is VIES-verified, so unverified preview doesn't silently become 0% on the real invoice

## Expanded Country Recognition

- **EU country matching** now accepts localised names — "Nederland", "Deutschland", "España", "Belgique" and dozens more — in addition to English names and ISO codes
- **VAT-prefix fallback** — if a profile country is missing or unrecognised, the VAT number's country prefix (NL..., DE..., FR...) is used as a backup for reverse-charge eligibility`,
    createdAt: new Date('2026-04-16T17:00:00Z'),
  },

  {
    version: "2.28.0",
    title: "Client Business Profile (VAT, CRN, EORI, Website, Mobile)",
    notes: `Clients can now fill in the B2B details distributors need for correct invoicing — without waiting to be asked at checkout:

## New Business Details Section

- **Mobile Number** — alongside the existing phone number
- **Chamber of Commerce / CRN** — KVK (NL), CIF (ES), SIREN (FR), etc.
- **EORI Number** — for intra-EU trade
- **VAT Number** — the EU VAT identifier used for reverse-charge eligibility
- **Website** — for B2B credibility

## VIES Verification

- **"Verified — Company Name" pill** shown next to the VAT field once your distributor has validated it against VIES
- **Client cannot self-verify** — the Firestore rule locks the vatValidated flag down to the server, so you can't accidentally (or intentionally) mark your own VAT as valid
- **Distributor verifies** from the client detail page with a single click

## Verify-VAT Diagnostics

- **Clearer error messages** when VIES verification can't save the result — distinct reasons (caller role, write failure, missing client ID) surface specifically in the toast instead of a silent "Verified" badge that disappears after refresh`,
    createdAt: new Date('2026-04-16T18:00:00Z'),
  },
];

async function addEntries() {
  console.log(`Adding ${changelogEntries.length} changelog entries for 2026-04-16...\n`);

  const batch = db.batch();
  const changelogCollection = db.collection('changelog');

  for (const entry of changelogEntries) {
    const docRef = changelogCollection.doc();
    batch.set(docRef, {
      version: entry.version,
      title: entry.title,
      notes: entry.notes,
      createdAt: Timestamp.fromDate(entry.createdAt),
    });
    console.log(`  + v${entry.version} — ${entry.title}`);
  }

  await batch.commit();

  // Flag all users for unread changelogs
  console.log('\nFlagging users for unread changelogs...');
  const usersSnap = await db.collection('users').get();
  const userBatch = db.batch();
  let flagged = 0;
  usersSnap.docs.forEach(doc => {
    userBatch.update(doc.ref, { unreadChangelogs: true });
    flagged += 1;
  });
  await userBatch.commit();
  console.log(`  Flagged ${flagged} users.`);

  console.log('\nDone.');
  process.exit(0);
}

addEntries().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});

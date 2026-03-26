#!/usr/bin/env node

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('/Users/saliano/VibeWorks/Vinylogix/docs/vinylogix-v1-firebase-adminsdk-fbsvc-5fb9a73b67.json', 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

const entries = [
  {
    version: "2.8.0",
    title: "VAT/Tax System & Order Request Emails",
    createdAt: new Date('2026-03-26T18:00:00Z'),
    notes: [
      "TAX / VAT",
      "",
      "• Distributors can now configure VAT settings per account in Settings",
      "• Choose between manual tax rate or automatic calculation via Stripe Tax",
      "• Set your VAT rate, tax label (BTW, IVA, MwSt, TVA, VAT), and price behavior (inclusive or exclusive)",
      "• B2B reverse charge: clients with a valid EU VAT number in another country automatically receive 0% VAT",
      "• Invoices now show full VAT breakdown: subtotal, tax rate, tax amount, and total",
      "• VAT information shown on cart, checkout, and order detail pages",
      "",
      "",
      "ORDER MANAGEMENT",
      "",
      "• Sidebar badge now shows all orders needing attention (requests, pending, awaiting payment)",
      "• Customer details on order page now show full client information: company, phone, email, address, CRN, VAT, EORI",
      "• New customer statistics on order page: total orders, total spent, and open payments at a glance",
      "• Quick link to client profile from order detail page",
      "",
      "",
      "EMAIL NOTIFICATIONS",
      "",
      "• Clients receive an email when they place an order request",
      "• Distributors receive an email with order details when a new request comes in",
      "• Clients are notified by email when their order is approved (with payment link)",
      "• Clients are notified when an order request is rejected",
    ].join("\n"),
  },
];

async function addChangelogs() {
  console.log('Adding changelog entries...\n');

  for (const entry of entries) {
    const docRef = await db.collection('changelog').add({
      version: entry.version,
      title: entry.title,
      notes: entry.notes,
      createdAt: Timestamp.fromDate(entry.createdAt),
    });
    console.log(`  Added: v${entry.version} - ${entry.title} (${docRef.id})`);
  }

  const usersSnapshot = await db.collection('users')
    .where('role', 'in', ['master', 'worker'])
    .get();

  if (!usersSnapshot.empty) {
    const batch = db.batch();
    usersSnapshot.forEach(doc => {
      batch.update(doc.ref, { unreadChangelogs: true });
    });
    await batch.commit();
    console.log(`\nNotified ${usersSnapshot.size} users.`);
  }

  process.exit(0);
}

addChangelogs().catch(err => { console.error(err); process.exit(1); });

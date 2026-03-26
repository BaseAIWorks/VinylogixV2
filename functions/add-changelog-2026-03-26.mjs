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
    version: "2.7.0",
    title: "Request Orders & Packing Slip Improvements",
    createdAt: new Date('2026-03-26T14:00:00Z'),
    notes: [
      "ORDER REQUESTS",
      "",
      "• Clients can now place orders without immediate payment",
      "• New 'Request Order' option at checkout — order is sent to the distributor for approval",
      "• Distributors can approve or reject order requests from the order detail page",
      "• When approved, a secure payment link is generated and available for the client",
      "• Clients see order status updates in real-time on their orders page",
      "• Distributors can enable or disable this feature in Settings > Order Settings",
      "",
      "",
      "PACKING SLIPS",
      "",
      "• Packing slips now load reliably for all users",
      "• Added a Print button that opens a clean print-ready view",
      "• Item weight and total order weight are now shown on the packing slip",
      "",
      "",
      "DISTRIBUTOR SETTINGS",
      "",
      "• Added EORI number field to Legal Business Information",
      "• EORI number now appears on invoices alongside CRN and VAT",
      "• Total order weight is now shown on invoices",
      "• Distributor logo above the sidebar menu is now displayed at full width",
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

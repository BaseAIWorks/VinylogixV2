#!/usr/bin/env node

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('/Users/saliano/VibeWorks/Vinylogix/docs/vinylogix-v1-firebase-adminsdk-fbsvc-5fb9a73b67.json', 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

const entries = [
  {
    version: "2.5.0",
    title: "Improved Checkout & Payment Options",
    createdAt: new Date('2026-03-25T10:00:00Z'),
    notes: [
      "CHECKOUT & PAYMENTS",
      "",
      "\u2022 All active payment methods from Stripe are now shown at checkout (iDEAL, Bancontact, card, and more)",
      "\u2022 Updated checkout label to clearly indicate multiple payment options are available",
      "",
      "",
      "INVOICES",
      "",
      "\u2022 Invoices are now more compact \u2014 artist and title shown on a single line",
      "\u2022 Reduced spacing between sections for a cleaner, tighter layout",
      "\u2022 Added support for multiple payment accounts (Bank, PayPal, or custom) in invoice settings",
      "\u2022 Client business details (CRN, VAT, EORI) now appear on invoices",
      "\u2022 Separate billing and shipping addresses are now clearly displayed",
      "\u2022 Footer text now supports up to 3 lines (240 characters max)",
      "\u2022 Pages break correctly when orders have many items",
      "",
      "",
      "INVENTORY",
      "",
      "\u2022 Artist name is now shown as the primary (larger) text on all record cards and detail pages",
      "\u2022 Album/single title is displayed below in smaller text",
      "\u2022 Scroll position is now preserved when navigating back from a product detail page",
      "",
      "",
      "CLIENT MANAGEMENT",
      "",
      "\u2022 Client and operator detail pages now load correctly",
      "\u2022 Clients can enter a separate billing address with structured fields (street, city, postcode, country)",
    ].join("\n"),
  },
  {
    version: "2.5.1",
    title: "Security & Stability Improvements",
    createdAt: new Date('2026-03-25T11:00:00Z'),
    notes: [
      "SECURITY",
      "",
      "\u2022 All API endpoints now require proper authentication",
      "\u2022 Improved protection against unauthorized access to client and order management",
      "\u2022 Added rate limiting to prevent abuse of account-related actions",
      "",
      "",
      "STABILITY",
      "",
      "\u2022 Fixed an issue where orders with many items could cause invoice content to overlap",
      "\u2022 Improved data consistency for orders placed via Stripe and PayPal",
      "\u2022 Various performance improvements across the platform",
    ].join("\n"),
  },
];

async function addChangelogs() {
  console.log('Adding changelog entries...\n');

  const batch = db.batch();
  const changelogCollection = db.collection('changelog');

  for (const entry of entries) {
    const docRef = changelogCollection.doc();
    batch.set(docRef, {
      version: entry.version,
      title: entry.title,
      notes: entry.notes,
      createdAt: Timestamp.fromDate(entry.createdAt),
    });
    console.log(`  Prepared: v${entry.version} - ${entry.title}`);
  }

  await batch.commit();
  console.log(`\nSuccessfully added ${entries.length} changelog entries!\n`);

  // Mark all master/worker users as having unread changelogs
  const usersSnapshot = await db.collection('users')
    .where('role', 'in', ['master', 'worker'])
    .get();

  if (!usersSnapshot.empty) {
    const userBatch = db.batch();
    usersSnapshot.forEach(doc => {
      userBatch.update(doc.ref, { unreadChangelogs: true });
    });
    await userBatch.commit();
    console.log(`Notified ${usersSnapshot.size} users about new updates.`);
  }

  process.exit(0);
}

addChangelogs().catch((error) => {
  console.error('Error adding changelog:', error);
  process.exit(1);
});

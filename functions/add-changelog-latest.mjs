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
    version: "2.6.0",
    title: "Artist Profile Pages & Music Discovery",
    createdAt: new Date('2026-03-26T10:00:00Z'),
    notes: [
      "ARTIST PROFILES",
      "",
      "• Artist names are now clickable everywhere — on record cards, detail pages, and the inventory list",
      "• Clicking an artist opens a dedicated profile page with their full biography and discography",
      "• AI-generated artist metadata: origin, active years, and a fun fact",
      "• Related Artists section shows similar artists from the same catalog",
      "• Genre tags on records are now clickable and filter your inventory instantly",
      "",
      "",
      "MORE BY THIS ARTIST",
      "",
      "• Record detail pages now show up to 4 other records by the same artist",
      "• Quick link to view the full artist discography",
      "",
      "",
      "INVOICE IMPROVEMENTS",
      "",
      "• Completely redesigned invoice layout for a more professional look",
      "• Client details now match the distributor's formatting style",
      "• Payment Terms and Payment Details shown side-by-side when both are present",
      "• Bank account details displayed per field (IBAN, BIC) instead of one long line",
      "• Footer text is no longer bold — cleaner, subtler appearance",
      "• Notes section moved below the total for better reading flow",
      "",
      "",
      "NAVIGATION & LAYOUT",
      "",
      "• Sidebar menu is now organized into logical categories (Catalog, Sales, People, System)",
      "• Sidebar is narrower for more content space",
      "• Distributor logo above the menu is now larger and more visible",
      "• Scroll position is preserved when navigating back from a record detail page",
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
  console.log(`\nSuccessfully added ${entries.length} changelog entry!\n`);

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

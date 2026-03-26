#!/usr/bin/env node

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('/Users/saliano/VibeWorks/Vinylogix/docs/vinylogix-v1-firebase-adminsdk-fbsvc-5fb9a73b67.json', 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function fix() {
  // 1. Find and update v2.6.0 — remove Invoice and Navigation sections
  const snapshot = await db.collection('changelog')
    .where('version', '==', '2.6.0')
    .get();

  for (const doc of snapshot.docs) {
    await doc.ref.update({
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
      ].join("\n"),
    });
    console.log(`Updated v2.6.0: removed Invoice and Navigation sections`);
  }

  // 2. Add new separate changelog for Navigation & Layout
  const navEntry = {
    version: "2.5.2",
    title: "Navigation & Layout Improvements",
    createdAt: Timestamp.fromDate(new Date('2026-03-25T12:00:00Z')),
    notes: [
      "NAVIGATION",
      "",
      "• Sidebar menu is now organized into logical categories (Catalog, Sales, People, System)",
      "• Sidebar is narrower for more content space",
      "• Distributor logo above the menu is now larger and more visible",
      "",
      "",
      "BROWSING",
      "",
      "• Scroll position is preserved when navigating back from a record detail page",
      "• Artist name is now shown as the primary text on record cards (album title below)",
    ].join("\n"),
  };

  const docRef = await db.collection('changelog').add(navEntry);
  console.log(`Added v2.5.2 Navigation & Layout with ID: ${docRef.id}`);

  process.exit(0);
}

fix().catch(err => { console.error(err); process.exit(1); });

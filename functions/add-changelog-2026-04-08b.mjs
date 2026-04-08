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
    version: "2.11.0",
    title: "New Registration Experience",
    createdAt: new Date('2026-04-08T16:00:00Z'),
    notes: [
      "REGISTRATION REDESIGN",
      "",
      "• The registration page now starts with two clear options: Client / Collector or Distributor / Shop",
      "• Each option explains what you can do with that account type",
      "• Client registration form appears inline after choosing — no page reload",
      "• Distributor registration redirects to the pricing page to choose a plan",
      "• Distributor registration page now links back to client registration for visitors who landed on the wrong page",
    ].join("\n"),
  },
  {
    version: "2.12.0",
    title: "New Pricing Plans & Variable Platform Fees",
    createdAt: new Date('2026-04-08T18:00:00Z'),
    notes: [
      "NEW PLANS",
      "",
      "• Pay-as-you-go plan for distributors — no monthly fee, pay only when you sell (8% transaction fee)",
      "• Collector plan for clients — unlimited collection, Discogs sync, wishlist alerts (€4.99/mo or €49/yr)",
      "• Free client accounts now limited to 100 records in personal collection",
      "",
      "",
      "VARIABLE PLATFORM FEES",
      "",
      "• Platform transaction fees now vary by subscription tier",
      "• Scale: 2% — Growth: 3% — Essential: 4% — Pay-as-you-go: 8%",
      "• Higher-tier distributors benefit from lower fees on every sale",
      "• Fee percentage is locked in at order creation for consistency",
      "",
      "",
      "PRICING PAGE",
      "",
      "• Pricing page now shows all four distributor plans side by side",
      "• Pay-as-you-go plan displayed as \"Free\" with clear fee-based model explanation",
      "• Fee comparison updated to reflect the new variable rates",
      "",
      "",
      "UNDER THE HOOD",
      "",
      "• Stripe products and prices can now be managed programmatically from the platform",
      "• Price IDs stored in Firestore instead of environment variables (with backward-compatible fallback)",
      "• Platform fee configuration stored centrally and applied automatically at checkout",
    ].join("\n"),
  },
  {
    version: "2.13.0",
    title: "Inventory Search Fix",
    createdAt: new Date('2026-04-08T14:00:00Z'),
    notes: [
      "SEARCH IMPROVEMENTS",
      "",
      "• Search now finds records across your entire inventory, not just the records loaded on screen",
      "• Typing a search term triggers a fresh query with results from all matching records",
      "• Pagination resets properly when searching — no more random records appearing while scrolling",
      "• Search is debounced (300ms) with a loading indicator for a smoother experience",
      "• Reduced unnecessary Firestore reads — search no longer triggers a full collection scan on every keystroke",
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

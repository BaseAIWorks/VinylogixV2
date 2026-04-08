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
    version: "2.9.0",
    title: "Public Storefront Pages",
    createdAt: new Date('2026-04-08T10:00:00Z'),
    notes: [
      "PUBLIC CATALOG",
      "",
      "• Every distributor now has a public storefront page at /storefront/{slug}",
      "• Three visibility modes: Open (anyone can browse), Private (login required), or Invite Only (approved clients only)",
      "• Open storefronts show the full catalog without pricing — prices and ordering are reserved for approved clients",
      "• Server-rendered pages with SEO metadata, Open Graph tags, and dynamic page titles",
      "• Visiting /{slug} now redirects to the storefront instead of the internal dashboard",
      "",
      "",
      "STOREFRONT CUSTOMIZATION",
      "",
      "• New Storefront tab in Settings to control visibility and appearance",
      "• Add a custom headline and description to welcome visitors",
      "• Choose between grid or compact catalog layout",
      "• Toggle search bar, genre filter, format filter, and record count",
      "• Copy and preview your public storefront URL directly from settings",
      "",
      "",
      "STOREFRONT EXPERIENCE",
      "",
      "• Branded header with distributor logo and company name",
      "• Search and filter records by genre or format",
      "• Infinite scroll pagination for large catalogs",
      "• Stock availability badges (In Stock, Low Stock, Out of Stock) visible to all visitors",
      "• Approved clients see prices and can add records to their cart directly from the storefront",
      "• Sign In and Register buttons for anonymous visitors",
      "• Cart icon with badge count in the header for logged-in users",
    ].join("\n"),
  },
  {
    version: "2.10.0",
    title: "Client Access Requests",
    createdAt: new Date('2026-04-08T12:00:00Z'),
    notes: [
      "REQUEST ACCESS",
      "",
      "• Logged-in users can request access to a distributor's catalog directly from the storefront",
      "• Request Access button appears for visitors who are not yet approved clients",
      "• For Invite Only storefronts, the request button is shown on the access gate page",
      "• Duplicate requests are automatically prevented",
      "",
      "",
      "DISTRIBUTOR REVIEW",
      "",
      "• Pending access requests appear on the Clients page with full requester details",
      "• View the requester's company name, contact name, email, phone, and location",
      "• Approve with one click — the requester immediately gains catalog access",
      "• Deny requests that don't meet your criteria",
      "",
      "",
      "EMAIL NOTIFICATIONS",
      "",
      "• Distributors receive an email when someone requests access, including full profile details",
      "• Requesters receive a confirmation email when their request is submitted",
      "• Requesters are notified by email when their request is approved (with a link to the catalog)",
      "• Requesters are notified by email when their request is denied",
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

#!/usr/bin/env node

/**
 * Script to add changelog entries directly to Firestore
 * Usage: node scripts/seed-changelog.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Load service account
const serviceAccount = JSON.parse(
  readFileSync('/Users/saliano/VibeWorks/Vinylogix/docs/vinylogix-v1-firebase-adminsdk-fbsvc-5fb9a73b67.json', 'utf8')
);

// Initialize Firebase Admin
const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

// Changelog entries to add
const changelogEntries = [
  {
    version: "2.4.0",
    title: "Enhanced Dashboard Experience",
    notes: `We've completely revamped the main dashboard with powerful new features:

• **Date Range Selector** - View your stats for Today, Last 7 days, Last 30 days, or All Time
• **Trend Indicators** - See how your metrics compare to the previous period with +/- percentage changes
• **Low Stock Alerts** - Quick access card showing items that need restocking
• **Improved Quick Links** - Better visual hierarchy for faster navigation
• **Role-Specific Views** - Tailored dashboard experience for Masters, Workers, and Clients`,
    createdAt: new Date('2026-02-07T10:00:00Z'),
  },
  {
    version: "2.3.0",
    title: "New Fulfillment Kanban Board",
    notes: `Introducing a visual workflow for order fulfillment:

• **Kanban View** - Drag-and-drop cards between Paid → Processing → Ready → Shipped columns
• **Bulk Actions** - Mark multiple orders as Processing or Shipped with one click
• **Order Age Indicator** - See how long orders have been waiting since payment
• **Quick Status Changes** - Click to advance orders through your workflow
• **Filtering** - Focus on specific order states or search by order number`,
    createdAt: new Date('2026-02-07T09:30:00Z'),
  },
  {
    version: "2.2.0",
    title: "Orders Page Improvements",
    notes: `Managing orders is now faster and more intuitive:

• **Status Tabs** - Quickly filter by All, Pending, Awaiting Payment, Paid, Shipped, or Cancelled
• **Bulk Actions** - Select multiple orders and update their status at once
• **Export to CSV** - Download your order data for accounting or analysis
• **Date Range Filters** - Find orders from specific time periods
• **Enhanced Search** - Search by order number, client name, or email`,
    createdAt: new Date('2026-02-07T09:00:00Z'),
  },
  {
    version: "2.1.0",
    title: "Improved Inventory Management",
    notes: `New features to help you manage your vinyl collection more efficiently:

• **Saved Filter Presets** - Save your favorite filter combinations for quick access
• **Keyboard Shortcuts** - Press / to search, N to add new records, G/L to switch views
• **Bulk Edit Mode** - Edit multiple records at once with visual highlighting of changes
• **Revert Changes** - Undo individual edits or revert all changes before saving
• **Quick Stock Updates** - Increment stock directly from the record card`,
    createdAt: new Date('2026-02-07T08:30:00Z'),
  },
  {
    version: "2.0.0",
    title: "Barcode Scanner Enhancements",
    notes: `Scanning vinyls is now faster and more convenient:

• **Keyboard Shortcuts** - Press B for barcode, A for AI scan, M for manual entry
• **Recent Scans History** - Access your last 5 scans with one click
• **Scan Type Indicators** - Visual badges show how each record was added
• **Improved Camera Detection** - Better automatic camera selection for mobile devices`,
    createdAt: new Date('2026-02-07T08:00:00Z'),
  },
  {
    version: "1.9.0",
    title: "Client & Operator Management Updates",
    notes: `Better tools for managing your team and customers:

• **Client Statistics** - See total orders and spending for each client
• **Activity Indicators** - Know which clients have been active recently
• **Operator Permissions** - View permission summaries at a glance
• **Bulk Actions** - Remove multiple clients or operators at once
• **Enhanced Search** - Find people quickly by name or email`,
    createdAt: new Date('2026-02-06T16:00:00Z'),
  },
  {
    version: "1.8.0",
    title: "Improved Import & Export",
    notes: `Streamlined data import process:

• **Drag & Drop Upload** - Simply drag your CSV file onto the page
• **Sample CSV Download** - Get a template with the correct column format
• **Enhanced Preview** - See status badges for each row before importing
• **Better Error Handling** - Clear messages when something goes wrong
• **Progress Indicators** - Track your import progress in real-time`,
    createdAt: new Date('2026-02-06T14:00:00Z'),
  },
  {
    version: "1.7.0",
    title: "Statistics & Reporting Upgrade",
    notes: `More powerful analytics for your business:

• **Global Date Range Picker** - Apply date filters to all charts at once
• **Period Comparison** - Compare current stats to previous periods
• **Export Reports** - Download your data as CSV for further analysis
• **Improved Charts** - Better visualizations for sales and inventory trends`,
    createdAt: new Date('2026-02-06T12:00:00Z'),
  },
  {
    version: "1.6.0",
    title: "Subscription Page Enhancements",
    notes: `Improved visibility into your subscription usage:

• **Usage Progress Bars** - Visual indicators for Records and Users limits
• **Color-Coded Warnings** - Orange when approaching limits, red when at capacity
• **Unlimited Tier Support** - Clear display for plans with no limits
• **Quick Plan Management** - Easy access to billing portal and plan changes`,
    createdAt: new Date('2026-02-06T10:00:00Z'),
  },
  {
    version: "1.5.0",
    title: "Notification System Improvements",
    notes: `Stay on top of what matters:

• **Mark All as Read** - Clear all notifications with one click
• **Type Filters** - Filter notifications by type (orders, stock alerts, etc.)
• **Grouped by Date** - Notifications organized by when they occurred
• **Improved Layout** - Cleaner, more scannable notification list`,
    createdAt: new Date('2026-02-05T16:00:00Z'),
  },
];

async function seedChangelog() {
  console.log('Starting changelog seed...\n');

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
    console.log(`  Prepared: v${entry.version} - ${entry.title}`);
  }

  await batch.commit();
  console.log(`\n✓ Successfully added ${changelogEntries.length} changelog entries to Firestore!`);

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
    console.log(`✓ Notified ${usersSnapshot.size} users about new updates.`);
  }

  process.exit(0);
}

seedChangelog().catch((error) => {
  console.error('Error seeding changelog:', error);
  process.exit(1);
});

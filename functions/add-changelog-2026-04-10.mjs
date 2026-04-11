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
    version: "2.14.0",
    title: "Admin Plan Management",
    createdAt: new Date('2026-04-10T09:00:00Z'),
    notes: [
      "PLAN CONTROLS",
      "",
      "• Each subscription plan now has a \"Plan Active\" switch in admin settings",
      "• Turning a plan off hides it from new signups on the pricing page and homepage",
      "• Existing subscribers on a deactivated plan are unaffected — they keep their current plan and billing",
      "• Deactivated plans are also blocked at the signup flow, so direct links can't slip through",
      "",
      "",
      "TRANSACTION FEES PER PLAN",
      "",
      "• Transaction fee percent is now editable per plan in admin settings",
      "• The Payments tab reflects whatever is currently set — no more hardcoded numbers",
      "• Fees are applied to product totals only (shipping is excluded) as before",
      "• Fee changes take effect immediately on new orders",
    ].join("\n"),
  },
  {
    version: "2.15.0",
    title: "Automatic Stripe Sync",
    createdAt: new Date('2026-04-10T10:00:00Z'),
    notes: [
      "ADMIN SETTINGS IS NOW THE SOURCE OF TRUTH",
      "",
      "• Saving plan changes in admin settings now automatically syncs to Stripe",
      "• New prices create new Stripe Price objects; old ones are archived in the background",
      "• Existing subscribers keep their original billing until they change plans (standard Stripe behaviour)",
      "• Plan descriptions and active/inactive state are mirrored to Stripe Products",
      "",
      "",
      "SAFETY FIRST",
      "",
      "• First save after the update is read-only — no Stripe writes, just discovery of existing products",
      "• Every save is logged with the superadmin, the changes, and the Stripe mode (live or test)",
      "• A kill switch is available to temporarily disable Stripe sync if needed",
      "• Existing Stripe fee and price configuration remains as a fallback so nothing breaks during the transition",
    ].join("\n"),
  },
  {
    version: "2.16.0",
    title: "New Signup Experience",
    createdAt: new Date('2026-04-10T13:00:00Z'),
    notes: [
      "A CLEARER STARTING POINT",
      "",
      "• New /get-started page asks upfront whether you collect records or sell them",
      "• Each option has a clear badge: \"Free forever\" for collectors, \"7-day free trial\" for stores",
      "• The Get Started button in the header now routes everyone to this gateway",
      "• Homepage hero CTA is now simply \"Get Started\" instead of the misleading \"Start Free Trial\"",
      "• Old /register/client links still work — they redirect automatically",
      "",
      "",
      "PLAN VISIBILITY DURING SIGNUP",
      "",
      "• New sidebar in the distributor registration form shows your chosen plan on every step",
      "• Price, trial badge, transaction fee, and included features are always visible",
      "• A \"Change plan\" link lets you return to pricing without losing your progress",
      "",
      "",
      "DRAFT AUTO-SAVE",
      "",
      "• Company details and personal info are now saved as you type",
      "• Refreshing the page or navigating away no longer wipes the form",
      "• Passwords are intentionally not saved, only non-sensitive fields",
      "• Draft clears automatically once you complete signup",
    ].join("\n"),
  },
  {
    version: "2.17.0",
    title: "Pricing Page Updates",
    createdAt: new Date('2026-04-10T14:00:00Z'),
    notes: [
      "FEWER CLICKS TO SIGN UP",
      "",
      "• Homepage pricing cards now link directly to the registration form",
      "• No more bouncing through the /pricing page just to click the same plan again",
      "• New \"See all billing options\" link at the bottom of the homepage grid for visitors who want monthly/quarterly/yearly comparisons",
      "",
      "",
      "LIVE DATA ACROSS THE MARKETING PAGES",
      "",
      "• Max Records edits in admin settings now reach the public pricing page and homepage immediately",
      "• Transaction fee label on each plan card reads from live admin settings",
      "• Fee comparison section uses the live Growth rate instead of a hardcoded number",
      "• Pricing page layout now adapts when plans are deactivated — cards stay centred instead of leaving gaps",
    ].join("\n"),
  },
  {
    version: "2.18.0",
    title: "Bug Fixes & Reliability",
    createdAt: new Date('2026-04-10T16:00:00Z'),
    notes: [
      "BUGS FIXED",
      "",
      "• Suppliers page now shows correct record counts per supplier (previously always showed 0)",
      "• \"My Collection\" and \"Wishlist\" stat cards on the viewer dashboard now show real counts",
      "• Orders page has a new \"Awaiting Approval\" tab — orders in that status were previously hidden",
      "• Sort dropdown on the Collection page now actually sorts (it was a silent no-op before)",
      "• \"Clear selection\" button in the inventory bulk-actions bar now works",
      "• Order total weight no longer renders as NaN on older orders missing the field",
      "",
      "",
      "UNDER THE HOOD",
      "",
      "• Full TypeScript audit across the codebase — 42 latent issues resolved",
      "• Firestore security rules updated so anonymous visitors on the pricing page always see live plans",
      "• Dashboard viewer stats now fetch real data from your personal records and wishlist",
    ].join("\n"),
  },
];

async function addChangelogs() {
  console.log('Adding changelog entries for 2026-04-10...\n');

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
    console.log(`\n  Notified ${usersSnapshot.size} users about new updates.`);
  }

  process.exit(0);
}

addChangelogs().catch(err => { console.error(err); process.exit(1); });

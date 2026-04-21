#!/usr/bin/env node
/**
 * Find Firebase Auth users that have NO matching Firestore `/users/{uid}`
 * document and — with confirmation — delete them from Firebase Auth.
 *
 * These orphans are typically created by a previously-buggy `addUser()`
 * flow where the secondary-app Auth creation succeeded but the Firestore
 * doc write failed with permission-denied. The resulting account is
 * unusable: it can't log in, it doesn't show up in any list, and its
 * email is "taken" so the master can't retry with the same address.
 *
 * Usage:
 *   node scripts/cleanup-orphan-auth-users.mjs --list          # preview
 *   node scripts/cleanup-orphan-auth-users.mjs --delete        # delete
 *   node scripts/cleanup-orphan-auth-users.mjs --delete-email <addr>
 *       # delete one specific orphan by email (useful when a distributor
 *       # is stuck on a single address and the full scan is overkill)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const listMode = args.includes('--list');
const deleteMode = args.includes('--delete');
const deleteEmailIdx = args.indexOf('--delete-email');
const deleteEmail = deleteEmailIdx >= 0 ? args[deleteEmailIdx + 1] : null;

if (!listMode && !deleteMode && !deleteEmail) {
  console.error('Usage:');
  console.error('  node scripts/cleanup-orphan-auth-users.mjs --list');
  console.error('  node scripts/cleanup-orphan-auth-users.mjs --delete');
  console.error('  node scripts/cleanup-orphan-auth-users.mjs --delete-email <address>');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  readFileSync('/Users/saliano/VibeWorks/Vinylogix/docs/vinylogix-v1-firebase-adminsdk-fbsvc-5fb9a73b67.json', 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth(app);
const db = getFirestore(app);

async function collectFirestoreUids() {
  const snap = await db.collection('users').get();
  const uids = new Set();
  for (const doc of snap.docs) uids.add(doc.id);
  return uids;
}

async function listAllAuthUsers() {
  const all = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    all.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return all;
}

async function findOrphans() {
  const [firestoreUids, authUsers] = await Promise.all([
    collectFirestoreUids(),
    listAllAuthUsers(),
  ]);
  const orphans = authUsers.filter((u) => !firestoreUids.has(u.uid));
  return { totalAuth: authUsers.length, totalFirestore: firestoreUids.size, orphans };
}

async function main() {
  if (deleteEmail) {
    let record;
    try {
      record = await auth.getUserByEmail(deleteEmail);
    } catch (err) {
      if (err?.code === 'auth/user-not-found') {
        console.error(`No Firebase Auth user found with email ${deleteEmail}.`);
        process.exit(1);
      }
      throw err;
    }
    const fsDoc = await db.collection('users').doc(record.uid).get();
    if (fsDoc.exists) {
      console.error(
        `Refusing to delete: Firebase Auth user ${record.uid} (${deleteEmail}) has a matching Firestore doc. ` +
        `This is NOT an orphan. Delete via the normal UI so app-level cleanup runs.`
      );
      process.exit(1);
    }
    await auth.deleteUser(record.uid);
    console.log(JSON.stringify({
      action: 'deleted',
      uid: record.uid,
      email: deleteEmail,
      createdAt: record.metadata?.creationTime || null,
    }, null, 2));
    return;
  }

  const { totalAuth, totalFirestore, orphans } = await findOrphans();

  if (listMode) {
    console.log(JSON.stringify({
      totalAuthUsers: totalAuth,
      totalFirestoreUsers: totalFirestore,
      orphanCount: orphans.length,
      orphans: orphans.map((u) => ({
        uid: u.uid,
        email: u.email,
        createdAt: u.metadata?.creationTime || null,
      })),
    }, null, 2));
    return;
  }

  // deleteMode
  if (orphans.length === 0) {
    console.log(JSON.stringify({ totalAuthUsers: totalAuth, orphanCount: 0, note: 'nothing to do' }, null, 2));
    return;
  }

  let deleted = 0;
  const errors = [];
  for (const u of orphans) {
    try {
      await auth.deleteUser(u.uid);
      deleted++;
    } catch (err) {
      errors.push({ uid: u.uid, email: u.email, error: err?.message || String(err) });
    }
  }
  console.log(JSON.stringify({
    totalAuthUsers: totalAuth,
    attempted: orphans.length,
    deleted,
    errors,
  }, null, 2));
  if (errors.length > 0) process.exit(1);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

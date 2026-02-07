#!/usr/bin/env node

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('/Users/saliano/VibeWorks/Vinylogix/docs/vinylogix-v1-firebase-adminsdk-fbsvc-5fb9a73b67.json', 'utf8')
);

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

async function checkChangelog() {
  const snapshot = await db.collection('changelog').get();
  console.log(`Found ${snapshot.size} changelog entries:\n`);

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`- v${data.version}: ${data.title}`);
  });

  process.exit(0);
}

checkChangelog().catch(console.error);

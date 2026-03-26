#!/usr/bin/env node

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('/Users/saliano/VibeWorks/Vinylogix/docs/vinylogix-v1-firebase-adminsdk-fbsvc-5fb9a73b67.json', 'utf8')
);

const app = initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore(app);

async function inspect() {
  const snapshot = await db.collection('changelog').get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const hasBullet = data.notes?.includes('•');
    const hasUnicode = data.notes?.includes('\\u2022');
    const hasDash = data.notes?.includes('- ');
    console.log(`v${data.version || '?'} "${data.title}" | bullets:${hasBullet} unicode:${hasUnicode} dashes:${hasDash}`);

    if (data.version === '2.5.0' || data.version === '2.5.1') {
      const firstBulletLine = data.notes.split('\n').find(l => l.trim().length > 3 && !l.trim().match(/^[A-Z\s&]+$/));
      if (firstBulletLine) {
        console.log('  Sample line:', firstBulletLine.substring(0, 80));
        console.log('  First 3 chars:', [...firstBulletLine.substring(0, 3)].map(c => `"${c}" (U+${c.charCodeAt(0).toString(16).padStart(4, '0')})`).join(', '));
      }
    }
  }

  process.exit(0);
}

inspect().catch(err => { console.error(err); process.exit(1); });

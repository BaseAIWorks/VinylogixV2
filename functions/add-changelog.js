const admin = require('firebase-admin');

// Initialize with application default credentials (from gcloud auth)
admin.initializeApp({
  projectId: 'vinylogix-v1'
});

const db = admin.firestore();

async function addChangelog() {
  const entry = {
    version: "1.1.0",
    title: "Business Profile & Invoice Improvements",
    createdAt: admin.firestore.Timestamp.now(),
    notes: `## New Features

### Legal Business Information
- Added comprehensive **Legal Business Information** section in Settings > Business tab
- New fields: Company name, full address (street, city, postcode, country), contact email, phone, website
- Business registration number (KVK/CIF) and Tax ID (TIN) fields
- **VAT Registration toggle** with conditional VAT number and country fields

### Business Profile Validation
- New notification banner alerts when business profile is incomplete
- Order processing is now blocked until required business information is filled in
- Ensures all invoices have proper company details

## Improvements

### Invoice PDF Redesign
- Professional invoice layout with distributor branding (logo, company name)
- Complete business details displayed (address, KVK, VAT number)
- Clean table layout for order items
- Payment status badge and notes section
- Contact footer with company information

### Settings Page Reorganization
- **Business tab**: All company/legal information in one place
- **Account tab**: Simplified for personal info only (name, email, password)
- Profile completion dialog now collects business info on first login

## Fixes

### Authentication & Permissions
- Fixed permission errors when custom claims aren't synced immediately after login
- Added fallback permission checks using distributor document lookup
- Resolved issues with fetching distributors, orders, notifications, and suppliers on initial login`
  };

  try {
    const docRef = await db.collection('changelog').add(entry);
    console.log('Changelog entry added with ID:', docRef.id);
    
    // Mark all master/worker users as having unread changelogs
    const usersSnapshot = await db.collection('users')
      .where('role', 'in', ['master', 'worker'])
      .get();
    
    const batch = db.batch();
    usersSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { unreadChangelogs: true });
    });
    await batch.commit();
    console.log('Notified ' + usersSnapshot.size + ' users of new changelog');
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding changelog:', error);
    process.exit(1);
  }
}

addChangelog();

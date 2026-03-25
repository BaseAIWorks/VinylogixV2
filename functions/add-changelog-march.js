const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'vinylogix-v1'
});

const db = admin.firestore();

async function addChangelogs() {
  const entries = [
    {
      version: "1.4.0",
      title: "Improved Checkout & Payment Options",
      createdAt: admin.firestore.Timestamp.now(),
      notes: [
        "CHECKOUT & PAYMENTS",
        "",
        "\u2022 All active payment methods from Stripe are now shown at checkout (iDEAL, Bancontact, card, and more)",
        "\u2022 Updated checkout label to clearly indicate multiple payment options are available",
        "",
        "",
        "INVOICES",
        "",
        "\u2022 Invoices are now more compact \u2014 artist and title shown on a single line",
        "\u2022 Reduced spacing between sections for a cleaner, tighter layout",
        "\u2022 Added support for multiple payment accounts (Bank, PayPal, or custom) in invoice settings",
        "\u2022 Client business details (CRN, VAT, EORI) now appear on invoices",
        "\u2022 Separate billing and shipping addresses are now clearly displayed on invoices",
        "\u2022 Footer text now supports up to 3 lines (240 characters max)",
        "\u2022 Pages break correctly when orders have many items",
        "",
        "",
        "INVENTORY",
        "",
        "\u2022 Artist name is now shown as the primary (larger) text on all record cards and detail pages",
        "\u2022 Album/single title is displayed below in smaller text",
        "\u2022 Scroll position is now preserved when navigating back from a product detail page",
        "",
        "",
        "CLIENT MANAGEMENT",
        "",
        "\u2022 Client and operator detail pages now load correctly",
        "\u2022 Clients can enter a separate billing address with structured fields (street, city, postcode, country)",
      ].join("\n"),
    },
    {
      version: "1.4.1",
      title: "Security & Stability Improvements",
      createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 1000)), // 1 second later to ensure order
      notes: [
        "SECURITY",
        "",
        "\u2022 All API endpoints now require proper authentication",
        "\u2022 Improved protection against unauthorized access to client and order management",
        "\u2022 Added rate limiting to prevent abuse of account-related actions",
        "",
        "",
        "STABILITY",
        "",
        "\u2022 Fixed an issue where orders with many items could cause invoice content to overlap",
        "\u2022 Improved data consistency for orders placed via Stripe and PayPal",
        "\u2022 Various performance improvements across the platform",
      ].join("\n"),
    },
  ];

  try {
    for (const entry of entries) {
      const docRef = await db.collection('changelog').add(entry);
      console.log(`Changelog "${entry.title}" added with ID: ${docRef.id}`);
    }

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

addChangelogs();

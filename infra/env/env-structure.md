# Environment Variable Structure

This document explains the purpose of each environment variable used in the Vinylogix project. These variables are stored in Google Secret Manager and accessed by Firebase App Hosting. For local development, they should be placed in a `.env.local` file.

## Firebase Configuration (Client-Side)

These variables are used by the Firebase client-side SDK to connect to your Firebase project. They are prefixed with `NEXT_PUBLIC_` to be exposed to the browser.

-   **`NEXT_PUBLIC_FIREBASE_API_KEY`**: The API key for your Firebase project.
-   **`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`**: Your project's authentication domain (e.g., `project-id.firebaseapp.com`).
-   **`NEXT_PUBLIC_FIREBASE_PROJECT_ID`**: Your Firebase project ID.
-   **`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`**: Your Cloud Storage bucket (e.g., `project-id.appspot.com`).
-   **`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`**: Your messaging sender ID.
-   **`NEXT_PUBLIC_FIREBASE_APP_ID`**: Your Firebase app ID.
-   **`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`**: Your Google Analytics measurement ID.

## Third-Party API Keys (Server-Side)

These variables are used on the server-side and should NOT be exposed to the client.

-   **`GOOGLE_AI_API_KEY`**: API key for Google's Generative Language API (Gemini), used by Genkit.
-   **`NEXT_PUBLIC_DISCOGS_API_TOKEN`**: Personal access token for the Discogs API. Used for fetching record data.
-   **`RESEND_API_KEY`**: API key for the Resend service, used for sending transactional emails (e.g., invitations).
-   **`NEXT_PUBLIC_SITE_URL`**: The canonical base URL for the deployed application (e.g., `https://vinylogix.com`). Used for generating absolute URLs for redirects and emails.

## Stripe Configuration (Server-Side and Client-Side)

-   **`STRIPE_SECRET_KEY`**: Your Stripe secret API key (starts with `sk_...`). **NEVER expose this to the client.**
-   **`STRIPE_WEBHOOK_SECRET`**: The signing secret for your Stripe webhook endpoint (starts with `whsec_...`).
-   **`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`**: Your Stripe publishable API key (starts with `pk_...`). This is safe to expose to the client.

### Stripe Price IDs

These variables link your application's subscription plans to the corresponding prices in your Stripe account.

-   `STRIPE_ESSENTIAL_MONTHLY_PRICE_ID`
-   `STRIPE_ESSENTIAL_3MONTHS_PRICE_ID`
-   `STRIPE_ESSENTIAL_YEARLY_PRICE_ID`
-   `STRIPE_GROWTH_MONTHLY_PRICE_ID`
-   `STRIPE_GROWTH_3MONTHS_PRICE_ID`
-   `STRIPE_GROWTH_YEARLY_PRICE_ID`
-   `STRIPE_SCALE_MONTHLY_PRICE_ID`
-   `STRIPE_SCALE_3MONTHS_PRICE_ID`
-   `STRIPE_SCALE_YEARLY_PRICE_ID`

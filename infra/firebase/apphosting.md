# Firebase App Hosting Configuration

This document outlines the setup for Firebase App Hosting, which runs the Next.js application on a managed Cloud Run service. All configuration is managed via `apphosting.yaml`.

## Cloud Run Service

-   **Service Name:** The service ID is managed by App Hosting, typically named `app-[PROJECT_ID]`.
-   **Region:** `europe-west4` (Netherlands)
-   **Runtime:** Node.js 20

## Environment Variables

The following environment variables are configured in `apphosting.yaml` and sourced from Google Cloud Secret Manager. **Values are not stored here.**

-   `GOOGLE_AI_API_KEY`
-   `NEXT_PUBLIC_DISCOGS_API_TOKEN`
-   `RESEND_API_KEY`
-   `STRIPE_SECRET_KEY`
-   `STRIPE_WEBHOOK_SECRET`
-   `STRIPE_ESSENTIAL_MONTHLY_PRICE_ID`
-   `STRIPE_ESSENTIAL_3MONTHS_PRICE_ID`
-   `STRIPE_ESSENTIAL_YEARLY_PRICE_ID`
-   `STRIPE_GROWTH_MONTHLY_PRICE_ID`
-   `STRIPE_GROWTH_3MONTHS_PRICE_ID`
-   `STRIPE_GROWTH_YEARLY_PRICE_ID`
-   `STRIPE_SCALE_MONTHLY_PRICE_ID`
-   `STRIPE_SCALE_3MONTHS_PRICE_ID`
-   `STRIPE_SCALE_YEARLY_PRICE_ID`
-   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
-   `NEXT_PUBLIC_SITE_URL`

## Service Account & Permissions

-   **Service Account:** `managed-by-app-hosting` (A per-backend service account automatically created and managed by App Hosting).
-   **Required IAM Roles (as defined in `apphosting.yaml`):**
    -   `roles/serviceusage.serviceUsageConsumer`: Allows the app to use enabled Google Cloud services.
    -   `roles/firebase.admin`: Provides broad access to Firebase services (e.g., for `firebase-admin` SDK).
    -   `roles/firebaseauth.admin`: Grants permission to manage Firebase Authentication users from the backend.

## Deployment Flow

-   Deployment is handled automatically by Firebase Studio upon a user's request or by connecting a GitHub repository to the Firebase App Hosting backend.
-   The process involves:
    1.  Building the Next.js application.
    2.  Containerizing the build output into a Docker image.
    3.  Pushing the image to Artifact Registry.
    4.  Deploying the new image as a revision to the managed Cloud Run service.

## Cross-Service Dependencies

-   **Firestore:** The backend requires access to read/write application data.
-   **Firebase Authentication:** The backend uses the Admin SDK to manage users and custom claims.
-   **Cloud Storage:** The backend may need to generate signed URLs or manage files.
-   **Google Secret Manager:** The backend requires access to retrieve the secrets for the environment variables listed above.

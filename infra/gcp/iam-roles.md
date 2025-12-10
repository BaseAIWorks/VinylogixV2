# IAM Roles and Service Accounts

This document outlines the key service accounts and IAM roles required for the `vinylogix-v1` project to function correctly.

## Key Service Accounts

1.  **App Hosting Service Account (`managed-by-app-hosting`)**
    -   **Description:** This is an automatically provisioned, per-backend service account that the Next.js application uses when running on Cloud Run via App Hosting. It's the identity of the server-side code.
    -   **Usage:** Used by the `firebase-admin` SDK on the server to interact with other Firebase and GCP services.
    -   **Required Roles (as defined in `apphosting.yaml`):**
        -   `roles/serviceusage.serviceUsageConsumer`: Allows the app to use other enabled Google Cloud APIs.
        -   `roles/firebase.admin`: Provides broad administrative access to Firebase services. This is a powerful role used for simplicity. For stricter security, it could be broken down into more granular roles like `roles/datastore.user` and `roles/firebaseauth.userAdmin`.
        -   `roles/firebaseauth.admin`: Specifically allows managing Firebase Authentication users (create, delete, update claims).

2.  **Cloud Functions Service Account (`[PROJECT_ID]@appspot.gserviceaccount.com`)**
    -   **Description:** The default service account used by Cloud Functions (2nd gen) when they execute.
    -   **Usage:** Used by the Cloud Functions (`getAllUsers`, `deleteAuthUser`, `setCustomUserClaimsOnUserWrite`) to interact with Firestore and Firebase Auth.
    -   **Required Roles:**
        -   `roles/datastore.user`: Required to read from and write to the Firestore database.
        -   `roles/firebaseauth.admin`: Required to read user details and set custom claims in Firebase Authentication.

## Developer IAM Roles

-   **Firebase Admin (`roles/firebase.admin`):** Provides full read/write access to Firebase services like Firestore and Auth. Suitable for lead developers.
-   **App Hosting Developer (`roles/apphosting.developer`):** Grants permissions to create and manage App Hosting backends.
-   **Viewer (`roles/viewer`):** Provides read-only access to most Google Cloud resources. Useful for team members who need to view logs or configurations without making changes.

## Manual IAM Bindings

-   For the most part, App Hosting manages the necessary bindings via `apphosting.yaml`.
-   No manual IAM bindings are typically required for a standard deployment. However, if a new GCP service is integrated (e.g., Cloud Tasks), the App Hosting service account may need additional roles granted manually in the GCP IAM console.

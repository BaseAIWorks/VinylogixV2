# Firebase Project Overview: vinylogixv1

This document provides a high-level summary of the Firebase project configuration.

## Project Identifiers

-   **Project ID:** `vinylogix-v1`
-   **Project Number:** `709401169654`

## Default Regions

-   **Firestore:** `europe-west4` (Netherlands)
-   **Cloud Functions / App Hosting:** `europe-west4` (Netherlands)
-   **Cloud Storage:** `europe-west4` (Netherlands) - Multi-region

## Enabled Firebase Services

-   **Authentication:**
    -   Handles user sign-up, login, and session management.
    -   Uses Email/Password and Google as sign-in providers.
    -   Custom claims are used to manage user roles (`superadmin`, `master`, `worker`, `viewer`).
-   **Firestore:**
    -   The primary NoSQL database for the application.
    -   Stores all application data, including users, distributors, records, and orders.
    -   Security is managed via `firestore.rules`.
-   **Cloud Storage:**
    -   Used for storing user-uploaded files, primarily album cover images.
    -   Security rules are defined in `storage.rules` to control access.
-   **Hosting:**
    -   Used as the backbone for App Hosting. Manages the connection to the Cloud Run backend and handles domain configuration.
-   **App Hosting:**
    -   The primary service for deploying and running the Next.js application.
    -   Builds the app and deploys it to a managed Cloud Run instance.
    -   Manages environment variables and IAM bindings.
-   **Cloud Functions:**
    -   Used for backend logic that runs in response to events (e.g., database writes) or direct calls from the client.
    -   Manages custom claims sync and secure administrative tasks.
-   **Analytics:**
    -   Google Analytics is enabled to track user engagement and application usage on the client side.

## Environment & Deployment

-   **Production Environment:** Deployed via Firebase App Hosting. The live URL is `https://vinylogix.com`.
-   **Development:** Developers run the application locally using `npm run dev`.

## Key CLI Commands

-   **Deploy Frontend & Backend:** `firebase deploy`
-   **Deploy Only Functions:** `firebase deploy --only functions`
-   **Run Emulators:** `firebase emulators:start`

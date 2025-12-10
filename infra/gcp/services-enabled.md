# Enabled Google Cloud APIs

This file lists the essential Google Cloud APIs that must be enabled for the `vinylogix-v1` project to function.

## Required APIs

The `apphosting.yaml` file specifies the following APIs as required, and App Hosting ensures they are enabled:

-   **Identity and Access Management (IAM) API (`iam.googleapis.com`)**
    -   **Dependency:** App Hosting, Cloud Functions.
    -   **Use:** To manage permissions for service accounts.

-   **Cloud Identity and Access Management (IAM) API (`cloudresourcemanager.googleapis.com`)**
    -   **Dependency:** App Hosting, Firebase.
    -   **Use:** For managing project-level resources and permissions.

-   **Service Usage API (`serviceusage.googleapis.com`)**
    -   **Dependency:** App Hosting, Firebase CLI.
    -   **Use:** Allows services to enable other APIs programmatically.

-   **Identity Toolkit API (`identitytoolkit.googleapis.com`)**
    -   **Dependency:** Firebase Authentication, Next.js client.
    -   **Use:** The backend for Firebase Authentication sign-in methods.

-   **Cloud Firestore API (`firestore.googleapis.com`)**
    -   **Dependency:** Next.js application (client and server), Cloud Functions.
    -   **Use:** Allows interaction with the Firestore database.

-   **Cloud Storage API (`storage.googleapis.com`)**
    -   **Dependency:** Next.js application (client and server).
    -   **Use:** Allows file uploads and downloads to/from Cloud Storage.

-   **Cloud Run Admin API (`run.googleapis.com`)**
    -   **Dependency:** Firebase App Hosting.
    -   **Use:** To manage the underlying Cloud Run service that hosts the Next.js app.

-   **Artifact Registry API (`artifactregistry.googleapis.com`)**
    -   **Dependency:** Firebase App Hosting.
    -   **Use:** To store the Docker container images for the application.

-   **Cloud Build API (`cloudbuild.googleapis.com`)**
    -   **Dependency:** Firebase App Hosting.
    -   **Use:** To build the application container during deployment.

-   **Generative Language API (`generativelanguage.googleapis.com`)**
    - **Dependency:** Genkit AI flows (`src/ai/flows/`).
    - **Use:** To interact with Google's generative AI models (e.g., Gemini) for features like content generation.

## Optional APIs

The following APIs are not strictly required for the current feature set but may be needed in the future:

-   **Cloud Tasks API (`cloudtasks.googleapis.com`)**
    -   **Potential Use:** For scheduling background jobs or deferring long-running tasks.
-   **Cloud Pub/Sub API (`pubsub.googleapis.com`)**
    -   **Potential Use:** For creating event-driven architectures between services.

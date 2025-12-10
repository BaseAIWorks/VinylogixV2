# Project Infrastructure Documentation: vinylogixv1

This document is the entry point for understanding the cloud infrastructure that powers the Vinylogix application. The infrastructure is primarily hosted on Firebase and Google Cloud Platform (GCP).

## Purpose

The goal of this documentation is to provide a clear, version-controlled source of truth for all infrastructure configurations. It helps new developers get up to speed quickly and ensures consistency between the live environment and the codebase.

## Folder Structure

-   [**firebase/**](./firebase/): Contains all documentation related to Firebase-specific services.
    -   [PROJECT-OVERVIEW.md](./firebase/PROJECT-OVERVIEW.md): High-level details about the Firebase project.
    -   [apphosting.md](./firebase/apphosting.md): Configuration for Firebase App Hosting, which runs the Next.js application.
    -   [auth-config.md](./firebase/auth-config.md): Details about Firebase Authentication setup.
-   [**gcp/**](./gcp/): Contains documentation for underlying Google Cloud services.
    -   [iam-roles.md](./gcp/iam-roles.md): Describes service accounts and their permissions.
    -   [services-enabled.md](./gcp/services-enabled.md): Lists all enabled Google Cloud APIs.
-   [**env/**](./env/): Documents environment variables.
    -   [env-structure.md](./env/env-structure.md): Explains the purpose of each environment variable.
    -   [.env.local.example](./env/.env.local.example): An example file for developers to use locally.

---

## Maintaining Consistency

It is crucial that this documentation stays in sync with the actual configuration in the Firebase and GCP consoles.

**When you make a change in the Firebase/GCP console, you MUST update the corresponding file in this `infra/` directory in the same commit.**

For example, if you enable a new API in the GCP console, you must add it to `infra/gcp/services-enabled.md`.

## How to Onboard a New Developer

1.  **Grant IAM Permissions:** In the Google Cloud Console, go to the IAM page for the `vinylogix-v1` project. Add the new developer's Google account as a new principal. Assign them the **"Firebase Admin"** and **"App Hosting Developer"** roles to start. Review [iam-roles.md](./gcp/iam-roles.md) for more granular permissions if needed.
2.  **Firebase Access:** Ensure the developer has been added to the Firebase project under **Project settings > Users and permissions**.
3.  **Set up `.env.local`:** The developer must create a `.env.local` file in their local project root. They should use [infra/env/.env.local.example](./env/.env.local.example) as a template.
4.  **Populate Secrets:** The developer will need the values for the environment variables. These must be shared securely (e.g., through a password manager, not via Git/email).
5.  **Run the App:** The developer should now be able to run `npm run dev` to start the local development server.

# Firebase Authentication Configuration

This document details the configuration of Firebase Authentication for the Vinylogix project.

## Enabled Providers

-   **Email/Password:** Standard email and password sign-in. This is the primary method for all user types.
-   **Google:** Allows users to sign up or sign in using their Google account. This is a convenient option for client users.

## Provider Configuration

-   No special configuration is required for the enabled providers. They use the default settings.

## Authorization Domain

-   **Auth Domain:** `vinylogix-v1.firebaseapp.com`
-   This domain is authorized for OAuth redirects (e.g., for Google sign-in).

## Password Policies

-   The default Firebase password policies are in effect. This includes a minimum length of 6 characters.

## Token Behavior

-   Client-side sessions are managed by the Firebase Auth SDK, which automatically refreshes ID tokens.
-   ID tokens are sent with requests to the backend (Cloud Functions) to verify the user's identity and roles.

## Custom Claims

Custom claims are critical for managing role-based access control (RBAC) in the application. They are set on a user's token and can be read securely on both the client and server.

-   **`role`**: (string) The user's primary role.
    -   Values: `superadmin`, `master`, `worker`, `viewer`.
-   **`distributorId`**: (string) For `master` and `worker` roles, this is the ID of the distributor they belong to.
-   **`accessibleDistributorIds`**: (array of strings) For `viewer` roles, this is a list of distributor IDs they are permitted to access.
-   **`unreadChangelogs`**: (boolean) A flag used to indicate if there are new, unread changelog entries for the user.

A Cloud Function (`setCustomUserClaimsOnUserWrite`) automatically synchronizes these claims whenever a user's document in Firestore is created or updated.

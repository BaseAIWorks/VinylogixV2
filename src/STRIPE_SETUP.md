
# Stripe Setup Guide for Vinylogix

This document provides a comprehensive guide to setting up Stripe for handling payments within the Vinylogix application. The setup involves two main components:

1.  **Stripe Billing:** For managing distributor subscriptions to the Vinylogix platform (e.g., Essential, Growth, Scale tiers).
2.  **Stripe Connect:** For processing payments from clients directly to distributors for record orders. This allows each distributor to have their own connected Stripe account.

---

## Prerequisites

- A Stripe account. If you don't have one, create it at [dashboard.stripe.com](https://dashboard.stripe.com).
- Access to your application's deployment environment to set environment variables (secrets).

---

## Part 1: Platform Subscription Billing (Stripe Billing)

This part covers charging your distributors for using the Vinylogix platform.

### Step 1: Create Products and Prices in Stripe

You need to create products in your Stripe Dashboard that correspond to the application's subscription tiers (`essential`, `growth`, `scale`).

1.  **Log in to your Stripe Dashboard.**
2.  Navigate to the **Products** tab.
3.  **Create three products:**
    -   Click **+ Add product**.
    -   Name them `Essential`, `Growth`, and `Scale`.
    -   You can add descriptions if you wish.
4.  **Add Prices for Each Product:**
    -   For **each** of the three products you created, you need to add two prices: one for monthly billing and one for yearly billing.
    -   Select a product (e.g., "Growth").
    -   In the "Pricing" section, click **+ Add another price**.
    -   Set the price, select the currency, and set the billing period to **Monthly**.
    -   Click **+ Add another price** again.
    -   Set the yearly price, select the currency, and set the billing period to **Yearly**.
5.  **Copy the Price IDs:**
    -   After creating each price, Stripe will generate a Price ID (e.g., `price_1P...`).
    -   You will need **six** Price IDs in total. Copy each one.

### Step 2: Configure Environment Variables

You must store your Stripe keys and the Price IDs as secure environment variables in your hosting environment (e.g., Firebase App Hosting secrets).

The application's code in `src/app/api/stripe/checkout-session/route.ts` expects the following variables:

-   `STRIPE_SECRET_KEY`: Your Stripe secret key (starts with `sk_...`). Find this in your Stripe Dashboard under **Developers > API keys**.
-   `STRIPE_WEBHOOK_SECRET`: You'll get this in the next step.
-   `STRIPE_ESSENTIAL_MONTHLY_PRICE_ID`: The Price ID for the monthly Essential plan.
-   `STRIPE_ESSENTIAL_YEARLY_PRICE_ID`: The Price ID for the yearly Essential plan.
-   `STRIPE_GROWTH_MONTHLY_PRICE_ID`: The Price ID for the monthly Growth plan.
-   `STRIPE_GROWTH_YEARLY_PRICE_ID`: The Price ID for the yearly Growth plan.
-   `STRIPE_SCALE_MONTHLY_PRICE_ID`: The Price ID for the monthly Scale plan.
-   `STRIPE_SCALE_YEARLY_PRICE_ID`: The Price ID for the yearly Scale plan.

### Step 3: Set Up Webhooks

Webhooks are essential for Stripe to communicate back to your application about payment events (e.g., successful payments, subscription updates).

1.  Navigate to **Developers > Webhooks** in your Stripe Dashboard.
2.  Click **+ Add an endpoint**.
3.  For the "Endpoint URL", you will need to create an API route in your application to handle these events. A common URL would be `https://<your-app-domain>/api/stripe/webhook`.
4.  For "Events to send", at a minimum, you must listen for:
    -   `checkout.session.completed`: To fulfill the purchase after a successful checkout.
    -   `invoice.payment_succeeded`: To confirm ongoing subscription payments.
    -   `customer.subscription.updated`: To handle plan changes.
    -   `customer.subscription.deleted`: To handle cancellations.
5.  After creating the endpoint, Stripe will reveal a **"Signing secret"** (starts with `whsec_...`). This is your `STRIPE_WEBHOOK_SECRET`. Add it to your environment variables.

---

## Part 2: Marketplace Payments (Stripe Connect)

This part enables clients to pay your distributors directly. The platform can optionally take an application fee from each transaction.

### Step 1: Enable Stripe Connect

1.  In your Stripe Dashboard, go to **Settings** (gear icon) > **Connect settings**.
2.  Follow the instructions to enable Stripe Connect for your platform. You will need to provide information about your business.
3.  Choose the **Standard** account type. This is the easiest to set up, as Stripe handles the identity verification and onboarding for your distributors.

### Step 2: Implement Distributor Onboarding

Your application needs a flow where your distributors (the "sellers") can connect their own Stripe accounts to your platform. This is now implemented in the app.

1.  **"Connect to Stripe" Button:** In the distributor's **Settings** page, under "Payouts & Billing", there is a button to start the Stripe Connect onboarding.
2.  **API Endpoint for Onboarding:** This button calls an API route at `src/app/api/stripe/connect/onboard/route.ts`. This route:
    -   Creates a new Stripe `account` of type `standard` if one doesn't already exist for the distributor.
    -   Saves the new Stripe Account ID (`acct_...`) to the distributor's profile in Firestore.
    -   Creates an `account_link` that redirects the user to Stripe's secure onboarding form.
    -   The `refresh_url` and `return_url` are set to bring the user back to the Settings page.
3.  **Storing the Stripe Account ID:** The Stripe Account ID is stored automatically in the distributor's document in Firestore upon creation. The status of the account (`stripeAccountStatus`) will also be updated via webhooks.

### Step 3: Implement the Payment Flow

When a client checks out from a distributor's catalog, you need to create a Stripe Checkout Session that directs the payment to the correct distributor.

1.  **API Endpoint for Checkout:** Your "Proceed to Checkout" button will call an API endpoint on your server (this part is not yet fully implemented but the foundation is laid).
2.  **Create a Checkout Session:** This endpoint will use `stripe.checkout.sessions.create`. The key parameters are:
    -   `line_items`: The items in the cart.
    -   `payment_intent_data.application_fee_amount`: (Optional) If you want to take a percentage of the sale, calculate your fee in cents and put it here.
    -   `payment_intent_data.transfer_data.destination`: This is the crucial part. Set this to the **Stripe Account ID of the distributor** who is being paid.

This ensures the client's payment is routed directly to the distributor's Stripe account, with your platform's fee automatically deducted if you configured one.

### Step 4: Stripe Connect Webhooks

In addition to the webhooks from Part 1, you should listen for Connect-specific events to keep your application in sync.

1.  In your webhook settings, add the following events:
    -   `account.updated`: This event fires when a connected account's details change, including their verification status (`details_submitted`, `charges_enabled`, `payouts_enabled`). Use this to update the `stripeAccountStatus` in your distributor's Firestore document.

---

## Summary of Code Files to Check/Implement

-   **Subscriptions:**
    -   `src/app/api/stripe/checkout-session/route.ts`: Contains the logic for creating subscription checkout sessions.
    -   `src/app/register/page.tsx`: The page that calls the checkout session endpoint.
    -   `(New file)` `src/app/api/stripe/webhook/route.ts`: The endpoint to handle incoming webhooks from Stripe for both Billing and Connect.
-   **Marketplace (Connect):**
    -   `src/app/api/stripe/connect/onboard/route.ts`: Creates account links for distributor onboarding. **(Added)**
    -   `(New file)` `src/app/api/stripe/connect/checkout/route.ts`: To create checkout sessions for client orders, routing payment to the distributor.
    -   `src/app/(app)/settings/page.tsx`: Where the "Connect to Stripe" button for distributors is located. **(Added)**
    -   `src/app/checkout/page.tsx`: The page that would call the Connect checkout endpoint.
-   **Invoicing:**
    -   `src/app/(app)/orders/[id]/page.tsx`: A "Download Invoice" button has been added to generate a PDF. **(Added)**

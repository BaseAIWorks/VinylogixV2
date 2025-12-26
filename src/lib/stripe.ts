import Stripe from 'stripe';

// Use fallback for build time, will throw at runtime if not set
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_build_only';

export const stripe = new Stripe(stripeKey, {
  apiVersion: '2024-06-20',
  typescript: true,
});

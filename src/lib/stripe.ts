import Stripe from 'stripe';

// Lazy initialization to avoid build-time errors
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set in the environment variables.');
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
    });
  }
  return stripeInstance;
}

// For backwards compatibility - lazily get stripe instance
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

import { Resend } from 'resend';

// Initialize Resend with API key (use fallback for build time)
const resend = new Resend(process.env.RESEND_API_KEY || 'dummy_key_for_build');

export { resend };

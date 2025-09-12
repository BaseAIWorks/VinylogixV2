
import { stripe } from '@/lib/stripe';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const sessionId = req.nextUrl.searchParams.get('session_id');

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
    }

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        // Return relevant, non-sensitive session data to the client
        return NextResponse.json({
            id: session.id,
            customer: session.customer,
            subscription: session.subscription,
            customer_details: session.customer_details,
            metadata: session.metadata, // Contains the original onboarding data
        });

    } catch (error: any) {
        console.error(`Stripe Retrieve Session Error (session_id: ${sessionId}):`, error);
        return NextResponse.json({ error: `Failed to retrieve Stripe session: ${error.message}` }, { status: 500 });
    }
}

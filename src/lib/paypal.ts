/**
 * PayPal Commerce Platform Client
 *
 * Handles PayPal API authentication and requests for marketplace payments.
 * Supports both sandbox and production environments.
 */

// Environment variables
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_SECRET = process.env.PAYPAL_SECRET || '';
const PAYPAL_PARTNER_ID = process.env.PAYPAL_PARTNER_ID || ''; // Your platform's merchant ID
const PAYPAL_BN_CODE = process.env.PAYPAL_BN_CODE || ''; // Partner attribution code

// Determine environment - use sandbox unless explicitly set to production
const isProduction = process.env.PAYPAL_MODE === 'production';
const PAYPAL_BASE_URL = isProduction
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// Cache for access token
let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get PayPal OAuth access token
 * Tokens are cached until they expire
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60 second buffer)
  if (cachedAccessToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  if (!PAYPAL_CLIENT_ID || !PAYPAL_SECRET) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64');

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('PayPal token error:', error);
    throw new Error('Failed to get PayPal access token');
  }

  const data = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  return cachedAccessToken as string;
}

/**
 * Make authenticated PayPal API request
 */
export async function paypalRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const accessToken = await getAccessToken();

  const { method = 'GET', body, headers = {} } = options;

  const response = await fetch(`${PAYPAL_BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Partner-Attribution-Id': PAYPAL_BN_CODE,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('PayPal API error:', response.status, errorText);
    throw new Error(`PayPal API error: ${response.status} - ${errorText}`);
  }

  // Handle empty responses (like 204 No Content)
  const text = await response.text();
  return text ? JSON.parse(text) : ({} as T);
}

/**
 * Generate Partner Referral link for merchant onboarding
 * This creates a link for distributors to connect their PayPal account
 */
export async function createPartnerReferral(params: {
  distributorId: string;
  distributorEmail: string;
  returnUrl: string;
}): Promise<{ actionUrl: string; partnerReferralId: string }> {
  const { distributorId, distributorEmail, returnUrl } = params;

  const response = await paypalRequest<any>('/v2/customer/partner-referrals', {
    method: 'POST',
    body: {
      tracking_id: distributorId,
      partner_config_override: {
        return_url: returnUrl,
        return_url_description: 'Return to Vinylogix to complete setup',
        action_renewal_url: returnUrl,
      },
      operations: [
        {
          operation: 'API_INTEGRATION',
          api_integration_preference: {
            rest_api_integration: {
              integration_method: 'PAYPAL',
              integration_type: 'THIRD_PARTY',
              third_party_details: {
                features: ['PAYMENT', 'REFUND', 'PARTNER_FEE'],
              },
            },
          },
        },
      ],
      products: ['EXPRESS_CHECKOUT'],
      legal_consents: [
        {
          type: 'SHARE_DATA_CONSENT',
          granted: true,
        },
      ],
      email: distributorEmail,
    },
  });

  // Extract the action URL from links
  const actionLink = response.links?.find((link: any) => link.rel === 'action_url');

  if (!actionLink) {
    throw new Error('No action URL returned from PayPal partner referral');
  }

  return {
    actionUrl: actionLink.href,
    partnerReferralId: response.links?.find((link: any) => link.rel === 'self')?.href?.split('/').pop() || '',
  };
}

/**
 * Get merchant onboarding status
 */
export async function getMerchantStatus(merchantId: string): Promise<{
  merchantId: string;
  trackingId: string;
  paymentsReceivable: boolean;
  primaryEmailConfirmed: boolean;
}> {
  const response = await paypalRequest<any>(
    `/v1/customer/partners/${PAYPAL_PARTNER_ID}/merchant-integrations/${merchantId}`,
    { method: 'GET' }
  );

  return {
    merchantId: response.merchant_id,
    trackingId: response.tracking_id,
    paymentsReceivable: response.payments_receivable || false,
    primaryEmailConfirmed: response.primary_email_confirmed || false,
  };
}

/**
 * Create PayPal Order for checkout
 * Uses platform fee (4%) similar to Stripe Connect
 */
export async function createOrder(params: {
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
    unitPrice: number; // in cents
  }>;
  totalAmount: number; // in cents
  platformFeeAmount: number; // in cents (4% of total)
  merchantId: string; // Distributor's PayPal merchant ID
  orderId: string; // Your internal order reference
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ paypalOrderId: string; approvalUrl: string }> {
  const { items, totalAmount, platformFeeAmount, merchantId, orderId, returnUrl, cancelUrl } = params;

  // Convert cents to dollars for PayPal (PayPal uses string amounts with 2 decimal places)
  const formatAmount = (cents: number) => (cents / 100).toFixed(2);

  const response = await paypalRequest<any>('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: orderId,
          description: `Order ${orderId}`,
          amount: {
            currency_code: 'EUR',
            value: formatAmount(totalAmount),
            breakdown: {
              item_total: {
                currency_code: 'EUR',
                value: formatAmount(totalAmount),
              },
            },
          },
          items: items.map(item => ({
            name: item.name.substring(0, 127), // PayPal max 127 chars
            description: item.description?.substring(0, 127),
            quantity: item.quantity.toString(),
            unit_amount: {
              currency_code: 'EUR',
              value: formatAmount(item.unitPrice),
            },
          })),
          payee: {
            merchant_id: merchantId,
          },
          payment_instruction: {
            disbursement_mode: 'INSTANT',
            platform_fees: [
              {
                amount: {
                  currency_code: 'EUR',
                  value: formatAmount(platformFeeAmount),
                },
              },
            ],
          },
        },
      ],
      application_context: {
        brand_name: 'Vinylogix',
        locale: 'en-US',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    },
  });

  const approvalLink = response.links?.find((link: any) => link.rel === 'approve');

  if (!approvalLink) {
    throw new Error('No approval URL returned from PayPal');
  }

  return {
    paypalOrderId: response.id,
    approvalUrl: approvalLink.href,
  };
}

/**
 * Capture PayPal Order after customer approval
 */
export async function captureOrder(paypalOrderId: string): Promise<{
  captureId: string;
  status: string;
  payerEmail: string;
  payerName: string;
}> {
  const response = await paypalRequest<any>(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
  });

  const capture = response.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    captureId: capture?.id || '',
    status: response.status,
    payerEmail: response.payer?.email_address || '',
    payerName: `${response.payer?.name?.given_name || ''} ${response.payer?.name?.surname || ''}`.trim(),
  };
}

/**
 * Get PayPal Order details
 */
export async function getOrder(paypalOrderId: string): Promise<any> {
  return paypalRequest(`/v2/checkout/orders/${paypalOrderId}`, { method: 'GET' });
}

/**
 * Refund a captured payment
 */
export async function refundCapture(captureId: string, amount?: number): Promise<{
  refundId: string;
  status: string;
}> {
  const body: any = {};

  if (amount) {
    body.amount = {
      value: (amount / 100).toFixed(2),
      currency_code: 'EUR',
    };
  }

  const response = await paypalRequest<any>(`/v2/payments/captures/${captureId}/refund`, {
    method: 'POST',
    body: Object.keys(body).length > 0 ? body : undefined,
  });

  return {
    refundId: response.id,
    status: response.status,
  };
}

/**
 * Verify webhook signature
 */
export async function verifyWebhookSignature(params: {
  webhookId: string;
  transmissionId: string;
  transmissionTime: string;
  certUrl: string;
  authAlgo: string;
  transmissionSig: string;
  webhookEvent: any;
}): Promise<boolean> {
  const response = await paypalRequest<any>('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: {
      webhook_id: params.webhookId,
      transmission_id: params.transmissionId,
      transmission_time: params.transmissionTime,
      cert_url: params.certUrl,
      auth_algo: params.authAlgo,
      transmission_sig: params.transmissionSig,
      webhook_event: params.webhookEvent,
    },
  });

  return response.verification_status === 'SUCCESS';
}

// Export configuration helpers
export const paypalConfig = {
  clientId: PAYPAL_CLIENT_ID,
  partnerId: PAYPAL_PARTNER_ID,
  isProduction,
  baseUrl: PAYPAL_BASE_URL,
};

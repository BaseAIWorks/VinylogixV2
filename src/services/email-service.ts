import { resend } from '@/lib/resend';
import { format } from 'date-fns';
import type { Order, OrderItemStatus, Distributor } from '@/types';
import { formatPriceForDisplay } from '@/lib/utils';
import { markdownToSafeHtml, escapeHtml } from '@/lib/markdown-utils';
import { ensureTrackingToken, buildTrackingUrl } from '@/lib/tracking-token';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

// Best-effort: returns a public tracking URL, generating the token if missing.
// Falls back to the logged-in "my orders" URL if admin access is unavailable.
async function getTrackingUrl(order: Order): Promise<string> {
  try {
    const token = order.trackingToken || await ensureTrackingToken(order.id);
    if (token) return buildTrackingUrl(token);
  } catch {
    /* ignore — fallthrough to authed URL */
  }
  return `${siteUrl}/my-orders/${order.id}`;
}

// Items that a customer should actually see / be billed for — excludes items the
// distributor marked as not_available or out_of_stock. Matches totals in order-service.
const getBillableItems = (order: Order) =>
  (order.items || []).filter(item => {
    const status = item.itemStatus || 'available';
    return status === 'available' || status === 'back_order';
  });

// ====================================================================
// Shared render helpers for customer-facing order emails.
// Produces a clean, consistent layout across approval / paid / update
// emails with optional distributor branding (logo + contact + colours).
// ====================================================================

type RenderableDistributor = Partial<Pick<Distributor,
  'name' | 'companyName' | 'logoUrl' | 'contactEmail' | 'phoneNumber' | 'website' |
  'addressLine1' | 'city' | 'postcode' | 'country' |
  'invoicePaymentTerms' | 'paymentAccounts' | 'iban' | 'bic' | 'bankName' | 'invoiceBankDetails'
>>;

const distributorDisplayName = (d?: RenderableDistributor | null): string => {
  if (!d) return 'Your distributor';
  return d.companyName || d.name || 'Your distributor';
};

const renderDistributorHeader = (distributor?: RenderableDistributor | null, accentColor = '#16a34a'): string => {
  const name = escapeHtml(distributorDisplayName(distributor));
  const logo = distributor?.logoUrl;
  return `
    <div style="padding: 32px 24px 20px 24px; border-bottom: 1px solid #e5e7eb; text-align: center; background: #ffffff;">
      ${logo
        ? `<img src="${escapeHtml(logo)}" alt="${name}" style="max-height: 96px; max-width: 280px; margin: 0 auto; display: block;" />`
        : `<div style="font-size: 22px; font-weight: 700; color: #111827;">${name}</div>`}
    </div>
    <div style="background: ${accentColor}; color: white; padding: 6px 24px; text-align: center; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;">
      ${name}
    </div>
  `;
};

const renderOrderSummary = (order: Order, distributor?: RenderableDistributor | null): string => {
  const billable = getBillableItems(order);
  const rows = billable.map(item => {
    const unit = formatPriceForDisplay(item.priceAtTimeOfOrder);
    const lineTotal = formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity);
    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
          <div style="font-weight: 600; color: #111827;">${escapeHtml(item.artist)}</div>
          <div style="color: #4b5563; font-size: 13px;">${escapeHtml(item.title)}</div>
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #f3f4f6; text-align: center; color: #4b5563; font-size: 13px; vertical-align: top;">${item.quantity}</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #f3f4f6; text-align: right; color: #4b5563; font-size: 13px; white-space: nowrap; vertical-align: top;">€ ${unit}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600; color: #111827; white-space: nowrap; vertical-align: top;">€ ${lineTotal}</td>
      </tr>
    `;
  }).join('');

  // Totals block — subtotal / shipping / tax / grand total.
  const subtotal = order.subtotalAmount;
  const shipping = order.shippingCost;
  const tax = order.taxAmount;
  const taxLabel = order.taxLabel || 'VAT';
  const taxRate = order.taxRate;
  const totalsRows: string[] = [];
  if (subtotal !== undefined) {
    totalsRows.push(`
      <tr>
        <td style="padding: 4px 12px; text-align: right; color: #6b7280; font-size: 13px;">Subtotal excl. ${escapeHtml(taxLabel)}</td>
        <td style="padding: 4px 12px; text-align: right; color: #111827; font-size: 13px; white-space: nowrap; width: 120px;">€ ${formatPriceForDisplay(subtotal)}</td>
      </tr>
    `);
  }
  if (typeof order.discountAmount === 'number' && order.discountAmount > 0) {
    const discountLabel = order.discountType === 'percent' && typeof order.discountValue === 'number'
      ? `Discount (${order.discountValue}%)`
      : 'Discount';
    totalsRows.push(`
      <tr>
        <td style="padding: 4px 12px; text-align: right; color: #6b7280; font-size: 13px;">${escapeHtml(discountLabel)}</td>
        <td style="padding: 4px 12px; text-align: right; color: #16a34a; font-size: 13px; font-weight: 600; white-space: nowrap;">− € ${formatPriceForDisplay(order.discountAmount)}</td>
      </tr>
    `);
  }
  if (typeof shipping === 'number' && shipping > 0) {
    totalsRows.push(`
      <tr>
        <td style="padding: 4px 12px; text-align: right; color: #6b7280; font-size: 13px;">Shipping${order.shippingZoneName ? ` (${escapeHtml(order.shippingZoneName)})` : ''}</td>
        <td style="padding: 4px 12px; text-align: right; color: #111827; font-size: 13px; white-space: nowrap;">€ ${formatPriceForDisplay(shipping)}</td>
      </tr>
    `);
  } else if (order.freeShippingApplied === true) {
    // Only shown when the distributor's shipping calc actually marked this
    // order as free (e.g. subtotal exceeded the free-shipping threshold).
    // Not a default — most orders will hit the paid-shipping row above.
    totalsRows.push(`
      <tr>
        <td style="padding: 4px 12px; text-align: right; color: #6b7280; font-size: 13px;">Shipping</td>
        <td style="padding: 4px 12px; text-align: right; color: #16a34a; font-size: 13px; font-weight: 600;">Free</td>
      </tr>
    `);
  } else if (order.shippingMethod === 'pickup') {
    totalsRows.push(`
      <tr>
        <td style="padding: 4px 12px; text-align: right; color: #6b7280; font-size: 13px;">Shipping</td>
        <td style="padding: 4px 12px; text-align: right; color: #6b7280; font-size: 13px; font-style: italic;">Pickup — no shipping</td>
      </tr>
    `);
  }
  if (tax !== undefined && tax > 0) {
    const rateTxt = typeof taxRate === 'number' ? ` (${taxRate}%)` : '';
    totalsRows.push(`
      <tr>
        <td style="padding: 4px 12px; text-align: right; color: #6b7280; font-size: 13px;">${escapeHtml(taxLabel)}${rateTxt}</td>
        <td style="padding: 4px 12px; text-align: right; color: #111827; font-size: 13px; white-space: nowrap;">€ ${formatPriceForDisplay(tax)}</td>
      </tr>
    `);
  } else if (order.isReverseCharge) {
    totalsRows.push(`
      <tr>
        <td style="padding: 4px 12px; text-align: right; color: #6b7280; font-size: 13px;">${escapeHtml(taxLabel)} (Reverse charge)</td>
        <td style="padding: 4px 12px; text-align: right; color: #6b7280; font-size: 13px; white-space: nowrap;">€ 0.00</td>
      </tr>
    `);
  }

  const orderRef = escapeHtml(order.orderNumber || order.id.slice(0, 8));
  let dateStr = '';
  try { dateStr = format(new Date(order.createdAt), 'dd MMM yyyy'); } catch { /* skip */ }

  return `
    <div style="padding: 20px 24px; background: white;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; gap: 16px; flex-wrap: wrap;">
        <div>
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Order</div>
          <div style="font-size: 18px; font-weight: 700; color: #111827;">#${orderRef}</div>
        </div>
        ${dateStr ? `<div style="text-align: right;">
          <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Date</div>
          <div style="font-size: 14px; color: #111827;">${escapeHtml(dateStr)}</div>
        </div>` : ''}
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
        <thead>
          <tr>
            <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; font-weight: 600;">Item</th>
            <th style="padding: 8px; text-align: center; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; font-weight: 600; width: 50px;">Qty</th>
            <th style="padding: 8px; text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; font-weight: 600; width: 80px;">Unit</th>
            <th style="padding: 8px 12px; text-align: right; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; font-weight: 600; width: 90px;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <table style="width: 100%; margin-top: 12px; border-collapse: collapse;">
        ${totalsRows.join('')}
        <tr>
          <td style="padding: 10px 12px; text-align: right; color: #111827; font-size: 15px; font-weight: 700; border-top: 2px solid #e5e7eb;">Total</td>
          <td style="padding: 10px 12px; text-align: right; color: #111827; font-size: 18px; font-weight: 700; white-space: nowrap; border-top: 2px solid #e5e7eb;">€ ${formatPriceForDisplay(order.totalAmount)}</td>
        </tr>
      </table>

      ${order.isReverseCharge ? `
        <p style="margin: 12px 0 0 0; font-size: 11px; color: #6b7280; font-style: italic;">
          * Reverse charge — VAT to be accounted for by the recipient.
        </p>
      ` : ''}
    </div>
  `;
};

// Renders the distributor's payment terms + bank/paypal account details as an
// email block. Only used by invoice-only flows where the customer must pay
// externally; never emits anything when no payment accounts are configured.
const renderPaymentDetailsSection = (distributor: RenderableDistributor | undefined | null, orderRef: string): string => {
  if (!distributor) return '';

  const accounts = distributor.paymentAccounts && distributor.paymentAccounts.length > 0
    ? distributor.paymentAccounts
    : (distributor.iban || distributor.bic || distributor.bankName)
      ? [{ id: 'legacy', type: 'bank' as const, bankName: distributor.bankName, iban: distributor.iban, bic: distributor.bic }]
      : [];

  const hasAccounts = accounts.length > 0;
  const hasTerms = !!(distributor.invoicePaymentTerms && distributor.invoicePaymentTerms.trim());
  if (!hasAccounts && !hasTerms) return '';

  const accountsHtml = accounts.map(acc => {
    if (acc.type === 'bank') {
      const lines: string[] = [];
      const label = acc.label || acc.bankName || 'Bank account';
      lines.push(`<div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${escapeHtml(label)}</div>`);
      if (acc.accountHolder) lines.push(`<div style="font-size: 13px; color: #4b5563;">Account holder: ${escapeHtml(acc.accountHolder)}</div>`);
      if (acc.iban) lines.push(`<div style="font-size: 14px; color: #111827; font-family: monospace; letter-spacing: 0.05em; margin-top: 2px;"><strong>IBAN:</strong> ${escapeHtml(acc.iban)}</div>`);
      if (acc.bic) lines.push(`<div style="font-size: 13px; color: #4b5563; font-family: monospace;"><strong>BIC:</strong> ${escapeHtml(acc.bic)}</div>`);
      return `<div style="padding: 12px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px;">${lines.join('')}</div>`;
    }
    if (acc.type === 'paypal') {
      const label = acc.label || 'PayPal';
      const emailText = acc.paypalEmail ? `<div style="font-size: 14px; color: #111827; margin-top: 2px;">${escapeHtml(acc.paypalEmail)}</div>` : '';
      return `<div style="padding: 12px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px;"><div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${escapeHtml(label)}</div>${emailText}</div>`;
    }
    const label = acc.label || 'Payment';
    const details = (acc as any).details ? `<div style="font-size: 13px; color: #4b5563; margin-top: 2px; white-space: pre-line;">${escapeHtml((acc as any).details)}</div>` : '';
    return `<div style="padding: 12px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px;"><div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${escapeHtml(label)}</div>${details}</div>`;
  }).join('');

  const termsHtml = hasTerms
    ? `<div style="margin-top: 8px; padding: 12px 14px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #78350f;">${markdownToSafeHtml(distributor.invoicePaymentTerms!)}</div>`
    : '';

  return `
    <div style="padding: 20px 24px; background: white; border-top: 1px solid #e5e7eb;">
      <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 8px;">How to pay</div>
      <p style="margin: 0 0 10px 0; font-size: 13px; color: #4b5563;">Please transfer the total to the account below and include <strong>#${escapeHtml(orderRef)}</strong> in the payment reference so we can match your payment.</p>
      ${accountsHtml}
      ${termsHtml}
    </div>
  `;
};

const renderDistributorFooter = (distributor?: RenderableDistributor | null): string => {
  const name = escapeHtml(distributorDisplayName(distributor));
  const contactParts: string[] = [];
  if (distributor?.contactEmail) contactParts.push(`<a href="mailto:${escapeHtml(distributor.contactEmail)}" style="color: #6b7280;">${escapeHtml(distributor.contactEmail)}</a>`);
  if (distributor?.phoneNumber) contactParts.push(escapeHtml(distributor.phoneNumber));
  if (distributor?.website) contactParts.push(`<a href="${escapeHtml(distributor.website)}" style="color: #6b7280;">${escapeHtml(distributor.website.replace(/^https?:\/\//, ''))}</a>`);
  const contactLine = contactParts.length ? `<div style="font-size: 12px; color: #6b7280; margin-top: 6px;">${contactParts.join(' · ')}</div>` : '';
  return `
    <div style="padding: 20px 24px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb;">
      <div>This email was sent by <strong>${name}</strong> via Vinylogix.</div>
      ${contactLine}
    </div>
  `;
};

// Compact Vinylogix platform footer. Appended to every email below the
// distributor-specific footer so recipients always know the system behind the
// order and how to get in touch with Vinylogix directly (support, partnership
// enquiries, sign up as a distributor). Kept deliberately small so it doesn't
// compete visually with the distributor's own contact block.
const renderPlatformFooter = (): string => {
  return `
    <div style="padding: 16px 24px 20px 24px; text-align: center; background: #111827; color: #9ca3af; font-size: 11px; line-height: 1.6;">
      <div style="margin-bottom: 6px;">
        <a href="${siteUrl}" style="color: #ffffff; text-decoration: none; font-weight: 600; letter-spacing: 0.02em;">Vinylogix</a>
        <span style="color: #6b7280;"> — B2B vinyl distribution platform</span>
      </div>
      <div>
        Questions? <a href="mailto:support@vinylogix.com" style="color: #d1d5db;">support@vinylogix.com</a>
        &nbsp;·&nbsp;
        Want to sell on Vinylogix? <a href="${siteUrl}/register" style="color: #d1d5db;">Become a distributor</a>
      </div>
      <div style="margin-top: 8px; color: #6b7280;">
        © ${new Date().getFullYear()} Vinylogix
        &nbsp;·&nbsp;
        <a href="${siteUrl}/privacy" style="color: #6b7280;">Privacy</a>
        &nbsp;·&nbsp;
        <a href="${siteUrl}/terms" style="color: #6b7280;">Terms</a>
      </div>
    </div>
  `;
};

const renderEmailShell = (opts: {
  distributor?: RenderableDistributor | null;
  title: string;
  intro: string;
  accentColor?: string;
  bodyHtml: string;
}): string => {
  const accent = opts.accentColor || '#16a34a';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 20px; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111827;">
  <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
    ${renderDistributorHeader(opts.distributor, accent)}
    <div style="padding: 24px 24px 8px 24px; background: white;">
      <h1 style="margin: 0 0 8px 0; font-size: 20px; color: #111827;">${escapeHtml(opts.title)}</h1>
      <p style="margin: 0; font-size: 14px; color: #4b5563; line-height: 1.55;">${opts.intro}</p>
    </div>
    ${opts.bodyHtml}
    ${renderDistributorFooter(opts.distributor)}
    ${renderPlatformFooter()}
  </div>
</body>
</html>
  `;
};

interface DistributorInfo {
  name: string;
  companyName?: string;
  contactEmail: string;
}

interface NewAccountEmailData {
  clientEmail: string;
  temporaryPassword: string;
  distributor: DistributorInfo;
  websiteUrl: string;
  customMessage?: string;
}

interface ExistingAccountEmailData {
  clientEmail: string;
  distributor: DistributorInfo;
  websiteUrl: string;
  customMessage?: string;
}

// Helper to safely get the distributor display name (HTML-escaped)
const safeDistributorName = (distributor: DistributorInfo): string =>
  escapeHtml(distributor.companyName || distributor.name);

// Renders the distributor's custom invitation message as an email block
const createCustomMessageHtml = (customMessage: string | undefined, distributor: DistributorInfo): string => {
  if (!customMessage || !customMessage.trim()) return '';
  return `
    <div style="margin: 20px 0; padding: 16px; background: #f9fafb; border-left: 4px solid #d1d5db; border-radius: 4px;">
      <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Message from ${escapeHtml(distributor.companyName || distributor.name)}</p>
      <div style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">${markdownToSafeHtml(customMessage)}</div>
    </div>
  `;
};

// Promotional footer for invitation emails — encourages shop owners to become distributors
const createDistributorPromoHtml = () => `
    <div style="text-align: center; margin-top: 32px; padding: 28px 24px; border-top: 1px solid #e5e7eb;">
        <img src="${siteUrl}/logo_v2_Black.png" alt="Vinylogix" width="140" style="display: block; margin: 0 auto 16px auto; max-width: 140px; height: auto;" />
        <p style="font-size: 16px; color: #1f2937; margin: 0 0 8px 0; font-weight: 700;">Are you a vinyl distributor or label?</p>
        <p style="font-size: 14px; color: #4b5563; margin: 0 0 20px 0; line-height: 1.6;">Start selling on Vinylogix — the complete B2B platform for vinyl businesses. Manage your catalog, connect with record shops worldwide, and streamline your orders.</p>
        <a href="${siteUrl}/register?ref=invitation-email" style="display: inline-block; background: #E86A33; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">Start Your Free Trial</a>
        <p style="font-size: 12px; color: #9ca3af; margin: 12px 0 0 0;">No credit card required</p>
    </div>
`;

const createDistributorPromoText = () => `
---
Are you a vinyl distributor or label?
Start selling on Vinylogix — the complete B2B platform for vinyl businesses.
Manage your catalog, connect with record shops worldwide, and streamline your orders.

Start your free trial: ${siteUrl}/register?ref=invitation-email
No credit card required.
---`;

// Template for new account creation
const createNewAccountEmailHtml = (data: NewAccountEmailData) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Vinylogix</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1f2937; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
        .credentials { background: #fff; padding: 20px; border-radius: 6px; border: 1px solid #d1d5db; margin: 20px 0; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎵 Welcome to Vinylogix</h1>
    </div>
    
    <div class="content"> 
        <h2>You've been invited by ${data.distributor.companyName || data.distributor.name}</h2>
        
        <p>Hello!</p>
        
        <p>You have been invited to join <strong>Vinylogix</strong> by <strong>${data.distributor.companyName || data.distributor.name}</strong>. A new client account has been created for you with access to their vinyl record catalog.</p>

        ${createCustomMessageHtml(data.customMessage, data.distributor)}

        <div class="credentials">
            <h3>🔐 Your Login Credentials</h3>
            <p><strong>Email:</strong> ${data.clientEmail}</p>
            <p><strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${data.temporaryPassword}</code></p>
        </div>
        
        <div class="warning">
            <strong>⚠️ Important:</strong> Please change your password after your first login for security purposes.
        </div>
        
        <p>Click the button below to access the platform:</p>
        
        <a href="https://vinylogix.com/login" class="button">Login to Vinylogix</a>
        
        <p>If you have any questions, please contact your distributor at <a href="mailto:${data.distributor.contactEmail}">${data.distributor.contactEmail}</a>.</p>
        
        <p>Welcome to the world of vinyl records!</p>
    </div>

    ${createDistributorPromoHtml()}

    <div class="footer">
        <p>This email was sent from Vinylogix on behalf of ${data.distributor.companyName || data.distributor.name}</p>
        <p>If you didn't expect this invitation, please contact <a href="mailto:${data.distributor.contactEmail}">${data.distributor.contactEmail}</a></p>
    </div>
</body>
</html>
`;

// Template for existing account invitation
const createExistingAccountEmailHtml = (data: ExistingAccountEmailData) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Distributor Access - Vinylogix</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1f2937; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
        .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
        .highlight { background: #ecfdf5; border: 1px solid #10b981; padding: 15px; border-radius: 6px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🎵 New Distributor Access</h1>
    </div>
    
    <div class="content">
        <h2>You've been granted access by ${data.distributor.companyName || data.distributor.name}</h2>
        
        <p>Hello!</p>
        
        <p>Great news! <strong>${data.distributor.companyName || data.distributor.name}</strong> has granted you access to their vinyl record catalog on <strong>Vinylogix</strong>.</p>

        ${createCustomMessageHtml(data.customMessage, data.distributor)}

        <div class="highlight">
            <h3>✅ Access Granted</h3>
            <p>You can now browse and purchase from their collection using your existing Vinylogix account.</p>
        </div>
        
        <p>Use your existing login credentials to access the platform:</p>
        
        <a href="https://vinylogix.com/login" class="button">Login to Vinylogix</a>
        
        <p>Once logged in, you'll be able to see ${data.distributor.companyName || data.distributor.name}'s catalog in addition to any other distributors you have access to.</p>
        
        <p>If you have any questions, please contact your distributor at <a href="mailto:${data.distributor.contactEmail}">${data.distributor.contactEmail}</a>.</p>
        
        <p>Happy record hunting!</p>
    </div>

    ${createDistributorPromoHtml()}

    <div class="footer">
        <p>This email was sent from Vinylogix on behalf of ${data.distributor.companyName || data.distributor.name}</p>
        <p>If you didn't expect this invitation, please contact <a href="mailto:${data.distributor.contactEmail}">${data.distributor.contactEmail}</a></p>
    </div>
</body>
</html>
`;

export async function sendNewAccountInvitationEmail(data: NewAccountEmailData) {
  try {
    const result = await resend.emails.send({
      from: 'Vinylogix <noreply@vinylogix.com>', // Replace with your verified domain
      to: [data.clientEmail],
      subject: `Welcome to Vinylogix - Invited by ${data.distributor.companyName || data.distributor.name}`,
      html: createNewAccountEmailHtml(data),
      text: `
Welcome to Vinylogix!

You have been invited by ${data.distributor.companyName || data.distributor.name} to join their vinyl record catalog.

Your login credentials:
Email: ${data.clientEmail}
Temporary Password: ${data.temporaryPassword}

Please change your password after your first login.

Login at: ${data.websiteUrl}/login

If you have questions, contact: ${data.distributor.contactEmail}

Welcome to the world of vinyl records!
${createDistributorPromoText()}
      `,
    });

    console.log('New account invitation email sent:', result.data?.id);
    return result;
  } catch (error) {
    console.error('Failed to send new account invitation email:', error);
    throw error;
  }
}

export async function sendExistingAccountInvitationEmail(data: ExistingAccountEmailData) {
  try {
    const result = await resend.emails.send({
      from: 'Vinylogix <noreply@vinylogix.com>', // Replace with your verified domain
      to: [data.clientEmail],
      subject: `New Distributor Access - ${data.distributor.companyName || data.distributor.name}`,
      html: createExistingAccountEmailHtml(data),
      text: `
New Distributor Access on Vinylogix!

${data.distributor.companyName || data.distributor.name} has granted you access to their vinyl record catalog.

You can now browse and purchase from their collection using your existing Vinylogix account.

Login at: ${data.websiteUrl}/login

If you have questions, contact: ${data.distributor.contactEmail}

Happy record hunting!
${createDistributorPromoText()}
      `,
    });

    console.log('Existing account invitation email sent:', result.data?.id);
    return result;
  } catch (error) {
    console.error('Failed to send existing account invitation email:', error);
    throw error;
  }
}

/**
 * Send order confirmation email to client
 */
export async function sendOrderConfirmation(order: Order): Promise<void> {
  const trackingUrl = await getTrackingUrl(order);
  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: order.viewerEmail,
      subject: `Order Confirmation #${order.orderNumber || order.id.slice(0, 8)}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .item { padding: 12px 0; border-bottom: 1px solid #e9ecef; }
              .total { padding: 16px 0; font-size: 18px; font-weight: 700; }
              .button { display: inline-block; background-color: #26222B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Thank you for your order!</h1>
              <p>We've received your order and will process it soon.</p>
            </div>

            <div class="card">
              <h2>Order Details</h2>
              <p><strong>Order Number:</strong> ${order.orderNumber || order.id.slice(0, 8)}</p>
              <p><strong>Date:</strong> ${format(new Date(order.createdAt), 'PPP')}</p>
              <p><strong>Status:</strong> ${order.status === 'paid' ? 'Paid ✓' : 'Processing'}</p>
            </div>

            <div class="card">
              <h2>Items Ordered</h2>
              ${getBillableItems(order).map(item => `
                <div class="item">
                  <p style="margin: 0; font-weight: 600;">${item.title}</p>
                  <p style="margin: 0; color: #6c757d;">${item.artist} • Qty: ${item.quantity} • €${formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}</p>
                </div>
              `).join('')}
              <div class="total">Total: €${formatPriceForDisplay(order.totalAmount)}</div>
            </div>

            <div class="card">
              <h2>Shipping Address</h2>
              <p style="white-space: pre-line;">${order.shippingAddress}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${trackingUrl}" class="button">View Order Details</a>
            </div>

            <p style="text-align: center; color: #6c757d; font-size: 14px;">
              Your order will be processed within 1-2 business days.
            </p>
          </body>
        </html>
      `,
    });

    console.log(`Order confirmation sent to ${order.viewerEmail} for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Failed to send order confirmation:', error);
  }
}

/**
 * Send a payment reminder to a customer with an outstanding awaiting_payment order.
 * Called by the scheduled cron or manually from the order page.
 */
export async function sendPaymentReminderEmail(order: Order, reminderNumber: number): Promise<void> {
  const trackingUrl = await getTrackingUrl(order);
  const paymentUrl = order.paymentLink || trackingUrl;
  const reminderLabel = reminderNumber === 1
    ? "Friendly reminder"
    : reminderNumber === 2
    ? "Second reminder"
    : "Final reminder";

  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: order.viewerEmail,
      subject: `${reminderLabel}: payment pending for order #${order.orderNumber || order.id.slice(0, 8)}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #fef3c7; border-radius: 8px; padding: 30px; margin-bottom: 20px; text-align: center; border: 1px solid #fde68a; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .button { display: inline-block; background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; }
              .muted { color: #6c757d; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0;">${reminderLabel}</h1>
              <p style="margin: 8px 0 0; color: #713f12;">Your order is still waiting on payment.</p>
            </div>

            <div class="card">
              <p>Hi ${escapeHtml(order.customerName || '')},</p>
              <p>We haven't received payment for order <strong>#${order.orderNumber || order.id.slice(0, 8)}</strong> yet. The items are still reserved for you.</p>
              <p><strong>Total:</strong> €${formatPriceForDisplay(order.totalAmount)}</p>
              <div style="text-align: center; margin: 24px 0;">
                <a href="${paymentUrl}" class="button">Complete payment</a>
              </div>
              ${reminderNumber === MAX_REMINDERS_CONST ? `
                <p class="muted">This is our last automatic reminder. If we don't receive payment soon, the order will be put on hold and the reserved stock released.</p>
              ` : ''}
            </div>

            <p class="muted" style="text-align: center;">
              Questions? Reply to this email or use the tracking page: <a href="${trackingUrl}">${trackingUrl}</a>
            </p>
          </body>
        </html>
      `,
    });

    console.log(`Payment reminder #${reminderNumber} sent to ${order.viewerEmail} for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Failed to send payment reminder:', error);
  }
}

const MAX_REMINDERS_CONST = 3;

/**
 * Send weekly financial digest to a distributor's master.
 * Reports covering `periodLabel` (e.g. "Apr 13 – Apr 19, 2026").
 */
export async function sendWeeklyDigestEmail(params: {
  to: string;
  distributorName: string;
  periodLabel: string;
  netRevenue: number;
  vatCollected: number;
  shippingCollected: number;
  netPayout: number;
  orderCount: number;
  refundedRevenue: number;
  refundCount: number;
  awaitingTotal: number;
  awaitingCount: number;
  prevNetRevenue?: number;
  statsUrl: string;
}): Promise<void> {
  const delta = params.prevNetRevenue !== undefined && params.prevNetRevenue !== 0
    ? ((params.netRevenue - params.prevNetRevenue) / params.prevNetRevenue) * 100
    : undefined;
  const deltaLabel = delta === undefined ? '' :
    delta > 0 ? `<span style="color:#16a34a;">▲ ${delta.toFixed(1)}%</span>` :
    delta < 0 ? `<span style="color:#dc2626;">▼ ${Math.abs(delta).toFixed(1)}%</span>` :
    `<span style="color:#6c757d;">— 0%</span>`;

  try {
    await resend.emails.send({
      from: 'Vinylogix Weekly <noreply@vinylogix.com>',
      to: params.to,
      subject: `Your weekly report — ${params.periodLabel}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head><meta charset="utf-8"></head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 640px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #16a34a, #059669); color: white; border-radius: 8px; padding: 28px; text-align: center; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 12px; opacity: 0.85; text-transform: uppercase; letter-spacing: 0.05em;">Weekly report</p>
              <h1 style="margin: 6px 0 0; font-size: 22px;">${escapeHtml(params.distributorName)}</h1>
              <p style="margin: 4px 0 0; font-size: 14px; opacity: 0.9;">${escapeHtml(params.periodLabel)}</p>
            </div>

            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
              <p style="margin: 0 0 4px; color: #6c757d; font-size: 12px; text-transform: uppercase;">Net revenue (ex-VAT)</p>
              <p style="margin: 0; font-size: 28px; font-weight: 700; color: #16a34a;">€${formatPriceForDisplay(params.netRevenue)} ${deltaLabel}</p>
              <p style="margin: 8px 0 0; color: #6c757d; font-size: 13px;">${params.orderCount} paid order${params.orderCount === 1 ? '' : 's'} this week</p>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
              <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 14px;">
                <p style="margin: 0; color: #6c757d; font-size: 11px; text-transform: uppercase;">VAT collected</p>
                <p style="margin: 2px 0 0; font-size: 18px; font-weight: 600;">€${formatPriceForDisplay(params.vatCollected)}</p>
              </div>
              <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 14px;">
                <p style="margin: 0; color: #6c757d; font-size: 11px; text-transform: uppercase;">Shipping collected</p>
                <p style="margin: 2px 0 0; font-size: 18px; font-weight: 600;">€${formatPriceForDisplay(params.shippingCollected)}</p>
              </div>
              <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 14px;">
                <p style="margin: 0; color: #6c757d; font-size: 11px; text-transform: uppercase;">Net payout</p>
                <p style="margin: 2px 0 0; font-size: 18px; font-weight: 600;">€${formatPriceForDisplay(params.netPayout)}</p>
              </div>
              <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 14px;">
                <p style="margin: 0; color: #713f12; font-size: 11px; text-transform: uppercase;">Awaiting payment</p>
                <p style="margin: 2px 0 0; font-size: 18px; font-weight: 600; color: #713f12;">€${formatPriceForDisplay(params.awaitingTotal)}</p>
                <p style="margin: 2px 0 0; font-size: 11px; color: #92400e;">${params.awaitingCount} outstanding</p>
              </div>
            </div>

            ${params.refundCount > 0 ? `
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
                <p style="margin: 0; color: #7f1d1d; font-size: 12px;">
                  <strong>Refunds this week:</strong> €${formatPriceForDisplay(params.refundedRevenue)} across ${params.refundCount} order${params.refundCount === 1 ? '' : 's'}
                </p>
              </div>
            ` : ''}

            <div style="text-align: center; margin: 24px 0;">
              <a href="${params.statsUrl}" style="display: inline-block; background-color: #26222B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                Open financial dashboard
              </a>
            </div>

            <p style="text-align: center; color: #6c757d; font-size: 12px;">
              You're receiving this because you opted in to weekly reports.
              Toggle it off in <a href="${siteUrl}/settings" style="color: #2563eb;">Settings</a>.
            </p>
          </body>
        </html>
      `,
    });
    console.log(`Weekly digest sent to ${params.to}`);
  } catch (error) {
    console.error('Failed to send weekly digest:', error);
  }
}

/**
 * Send shipping notification to client
 */
export async function sendShippingNotification(order: Order): Promise<void> {
  if (!order.trackingNumber) return;

  const trackingUrl = await getTrackingUrl(order);

  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: order.viewerEmail,
      subject: `Your order #${order.orderNumber || order.id.slice(0, 8)} has shipped!`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #d4edda; border-radius: 8px; padding: 30px; margin-bottom: 20px; text-align: center; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .button { display: inline-block; background-color: #26222B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📦 Good news! Your order is on its way.</h1>
            </div>

            <div class="card">
              <h2>Shipping Details</h2>
              <p><strong>Order Number:</strong> ${order.orderNumber || order.id.slice(0, 8)}</p>
              ${order.carrier ? `<p><strong>Carrier:</strong> ${order.carrier.toUpperCase()}</p>` : ''}
              <p><strong>Tracking Number:</strong> <code>${order.trackingNumber}</code></p>
              ${order.estimatedDeliveryDate ? `<p><strong>Estimated Delivery:</strong> ${format(new Date(order.estimatedDeliveryDate), 'PPP')}</p>` : ''}
            </div>

            <div style="text-align: center; margin: 30px 0;">
              ${order.trackingUrl ? `<a href="${order.trackingUrl}" class="button">Track Package</a>` : ''}
              <a href="${trackingUrl}" class="button" style="margin-left: 10px;">View Order</a>
            </div>
          </body>
        </html>
      `,
    });

    console.log(`Shipping notification sent to ${order.viewerEmail} for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Failed to send shipping notification:', error);
  }
}

/**
 * Send password reset email to user
 */
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  try {
    await resend.emails.send({
      from: 'Vinylogix <noreply@vinylogix.com>',
      to: email,
      subject: 'Reset Your Vinylogix Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1f2937; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
              .button { display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
              .button:hover { background: #2563eb; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
              .warning { background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0; font-size: 14px; }
              .link-text { word-break: break-all; font-size: 12px; color: #6b7280; background: #f3f4f6; padding: 10px; border-radius: 4px; margin-top: 15px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>

            <div class="content">
              <p>Hello,</p>

              <p>We received a request to reset the password for your Vinylogix account associated with <strong>${email}</strong>.</p>

              <p>Click the button below to reset your password:</p>

              <div style="text-align: center;">
                <a href="${resetLink}" class="button">Reset Password</a>
              </div>

              <div class="warning">
                <strong>⏰ This link expires in 1 hour.</strong><br>
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </div>

              <p class="link-text">
                If the button doesn't work, copy and paste this link into your browser:<br>
                ${resetLink}
              </p>
            </div>

            <div class="footer">
              <p>This email was sent by Vinylogix</p>
              <p>If you have any questions, please contact support.</p>
            </div>
          </body>
        </html>
      `,
      text: `
Password Reset Request

We received a request to reset the password for your Vinylogix account (${email}).

Click this link to reset your password:
${resetLink}

This link expires in 1 hour.

If you didn't request a password reset, you can safely ignore this email.
      `,
    });

    console.log(`Password reset email sent to ${email}`);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

/**
 * Send new order notification to distributor
 */
export async function sendNewOrderNotification(order: Order, distributorEmail: string): Promise<void> {
  try {
    const platformFee = order.platformFeeAmount ? (order.platformFeeAmount / 100).toFixed(2) : '0.00';
    const payout = order.platformFeeAmount
      ? (order.totalAmount - (order.platformFeeAmount / 100)).toFixed(2)
      : order.totalAmount.toFixed(2);

    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: distributorEmail,
      subject: `New Order Received #${order.orderNumber || order.id.slice(0, 8)}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #d1ecf1; border-radius: 8px; padding: 30px; margin-bottom: 20px; text-align: center; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .button { display: inline-block; background-color: #26222B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
              .payout { font-size: 20px; color: #28a745; font-weight: 700; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>🎉 New Order Received!</h1>
            </div>

            <div class="card">
              <h2>Order Summary</h2>
              <p><strong>Order Number:</strong> ${order.orderNumber || order.id.slice(0, 8)}</p>
              <p><strong>Customer:</strong> ${order.customerName} (${order.viewerEmail})</p>
              <p><strong>Items:</strong> ${order.items.length} item(s)</p>
            </div>

            <div class="card">
              <h2>Payment Details</h2>
              <p>Order Total: €${formatPriceForDisplay(order.totalAmount)}</p>
              <p>Platform Fee (4%): -€${platformFee}</p>
              <p class="payout">Your Payout: €${payout}</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${siteUrl}/orders/${order.id}" class="button">View Order Details</a>
            </div>

            <p style="text-align: center; color: #6c757d;">
              Please process this order within 1-2 business days.
            </p>
          </body>
        </html>
      `,
    });

    console.log(`New order notification sent to distributor ${distributorEmail} for order ${order.orderNumber}`);
  } catch (error) {
    console.error('Failed to send new order notification:', error);
  }
}

/**
 * Sends the client a confirmation that their Request Order was received and
 * is awaiting the distributor's approval. Uses the shared branded template so
 * the client clearly sees which distributor they ordered from.
 */
export async function sendOrderRequestConfirmation(
  order: Order,
  distributor?: RenderableDistributor | null
): Promise<void> {
  const distributorName = distributorDisplayName(distributor);
  const orderRef = order.orderNumber || order.id.slice(0, 8);
  const replyTo = distributor?.contactEmail || undefined;

  const cta = `
    <div style="padding: 8px 24px 24px 24px; background: white; text-align: center;">
      <a href="${siteUrl}/my-orders/${order.id}" style="display: inline-block; background: #111827; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 14px;">View Order Status</a>
      <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">No payment is required at this time. You'll be notified when <strong>${escapeHtml(distributorName)}</strong> has reviewed your request.</p>
    </div>
  `;

  const bodyHtml = renderOrderSummary(order, distributor) + cta;

  const html = renderEmailShell({
    distributor,
    title: 'Order request received',
    intro: `Thanks for your order! Your request has been submitted to <strong>${escapeHtml(distributorName)}</strong> and is awaiting approval. You'll receive another email once your order is reviewed.`,
    accentColor: '#d97706',
    bodyHtml,
  });

  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: [order.viewerEmail],
      ...(replyTo ? { replyTo } : {}),
      subject: `Order Request Received — #${orderRef}`,
      html,
      text: `Order Request Received — #${orderRef}

Hello ${order.customerName || ''},

Thanks for your order! Your request has been submitted to ${distributorName} and is awaiting approval. You'll receive another email once it's reviewed.

Order total: € ${formatPriceForDisplay(order.totalAmount)}

No payment is required at this time.

View your order: ${siteUrl}/my-orders/${order.id}
`,
    });
    console.log(`Order request confirmation sent to ${order.viewerEmail}`);
  } catch (error) {
    console.error('Failed to send order request confirmation:', error);
  }
}

/**
 * Sends the distributor a "new order to review" notification when a client
 * submits a Request Order. Uses the shared branded template so the email
 * matches the look of customer-facing emails the distributor sees in reply
 * threads.
 */
export async function sendOrderRequestNotification(
  order: Order,
  distributorEmail: string,
  distributor?: RenderableDistributor | null
): Promise<void> {
  const orderRef = order.orderNumber || order.id.slice(0, 8);

  const customerBusinessLines: string[] = [];
  if (order.customerVatNumber) customerBusinessLines.push(`VAT: ${escapeHtml(order.customerVatNumber)}`);
  if (order.customerChamberOfCommerce) customerBusinessLines.push(`CRN: ${escapeHtml(order.customerChamberOfCommerce)}`);
  if (order.customerEoriNumber) customerBusinessLines.push(`EORI: ${escapeHtml(order.customerEoriNumber)}`);
  const customerBusiness = customerBusinessLines.length
    ? `<div style="font-size: 12px; color: #6b7280; margin-top: 6px;">${customerBusinessLines.join(' · ')}</div>`
    : '';

  const customerBlock = `
    <div style="padding: 16px 24px; background: white; border-top: 1px solid #e5e7eb;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; font-weight: 600; margin-bottom: 6px;">Customer</div>
      <div style="font-size: 14px; color: #111827; font-weight: 600;">${escapeHtml(order.customerName || 'Unknown')}</div>
      ${order.customerCompanyName ? `<div style="font-size: 13px; color: #4b5563;">${escapeHtml(order.customerCompanyName)}</div>` : ''}
      <div style="font-size: 13px; color: #4b5563;">
        <a href="mailto:${escapeHtml(order.viewerEmail)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(order.viewerEmail)}</a>
        ${order.phoneNumber ? ` · ${escapeHtml(order.phoneNumber)}` : ''}
      </div>
      ${customerBusiness}
    </div>
  `;

  const cta = `
    <div style="padding: 8px 24px 24px 24px; background: white; text-align: center;">
      <a href="${siteUrl}/orders/${order.id}" style="display: inline-block; background: #d97706; color: white; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">Review &amp; Approve Order</a>
      <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">Approve to generate the invoice and (optionally) send a payment link; or reject with a reason.</p>
    </div>
  `;

  const bodyHtml = customerBlock + renderOrderSummary(order, distributor) + cta;

  const html = renderEmailShell({
    distributor,
    title: 'New order request — action required',
    intro: `A client has submitted an order request that's waiting for your approval. Review the details below and approve or reject from the order page.`,
    accentColor: '#d97706',
    bodyHtml,
  });

  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: [distributorEmail],
      subject: `New Order Request — #${orderRef} · Action required`,
      html,
      text: `New Order Request — #${orderRef}

A client has submitted a Request Order that needs your review.

Customer: ${order.customerName || 'Unknown'} (${order.viewerEmail})
${order.customerCompanyName ? `Company: ${order.customerCompanyName}\n` : ''}${customerBusinessLines.length ? customerBusinessLines.join(' · ') + '\n' : ''}
Order total: € ${formatPriceForDisplay(order.totalAmount)}

Review: ${siteUrl}/orders/${order.id}
`,
    });
    console.log(`Order request notification sent to ${distributorEmail}`);
  } catch (error) {
    console.error('Failed to send order request notification:', error);
  }
}

/**
 * Send order approved email to client with payment link
 */
export async function sendOrderApprovedEmail(
  order: Order,
  paymentLink?: string,
  distributor?: RenderableDistributor | null,
  invoicePdf?: { base64: string; filename: string }
): Promise<void> {
  const distributorName = distributorDisplayName(distributor);
  const orderRef = order.orderNumber || order.id.slice(0, 8);
  const replyTo = distributor?.contactEmail || undefined;

  const payButton = paymentLink ? `
    <div style="padding: 8px 24px 24px 24px; background: white; text-align: center;">
      <a href="${escapeHtml(paymentLink)}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 44px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(22,163,74,0.25);">Pay Securely</a>
      <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">This payment link expires in 24 hours.</p>
      <p style="margin: 14px 0 0 0; color: #6b7280; font-size: 12px;"><a href="${siteUrl}/my-orders/${order.id}" style="color: #6b7280;">View order details on Vinylogix</a></p>
    </div>
  ` : `
    <div style="padding: 8px 24px 24px 24px; background: white; text-align: center;">
      <a href="${siteUrl}/my-orders/${order.id}" style="display: inline-block; background: #111827; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 14px;">View Order Details</a>
    </div>
  `;

  const pdfNote = invoicePdf ? `
    <div style="padding: 8px 24px; background: white; text-align: center; color: #6b7280; font-size: 12px;">
      📎 A PDF invoice is attached to this email for your records.
    </div>
  ` : '';

  const bodyHtml = renderOrderSummary(order, distributor) + payButton + pdfNote;

  const intro = paymentLink
    ? `<strong>${escapeHtml(distributorName)}</strong> has approved your order. Click below to complete your payment securely — you'll be charged exactly the amount shown here.`
    : `<strong>${escapeHtml(distributorName)}</strong> has approved your order.`;

  const html = renderEmailShell({
    distributor,
    title: 'Your order has been approved',
    intro,
    accentColor: '#16a34a',
    bodyHtml,
  });

  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: [order.viewerEmail],
      ...(replyTo ? { replyTo } : {}),
      subject: `Order Approved — #${orderRef} · Payment required`,
      ...(invoicePdf ? { attachments: [{ filename: invoicePdf.filename, content: invoicePdf.base64 }] } : {}),
      html,
      text: `Your order #${orderRef} has been approved by ${distributorName}.

Total: € ${formatPriceForDisplay(order.totalAmount)}
${paymentLink ? `\nPay now: ${paymentLink}\n(link expires in 24 hours)` : ''}
${invoicePdf ? '\nA PDF invoice is attached for your records.' : ''}

View your order: ${siteUrl}/my-orders/${order.id}
`,
    });
    console.log(`Order approved email sent to ${order.viewerEmail}`);
  } catch (error) {
    console.error('Failed to send order approved email:', error);
  }
}

/**
 * Send order rejected email to client
 */
export async function sendOrderRejectedEmail(order: Order, reason?: string): Promise<void> {
  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: order.viewerEmail,
      subject: `Order Update #${order.orderNumber || order.id.slice(0, 8)}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #fee2e2; border-radius: 8px; padding: 30px; margin-bottom: 20px; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .button { display: inline-block; background-color: #26222B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Order Could Not Be Processed</h1>
              <p>Unfortunately, the seller was unable to process your order at this time.</p>
            </div>

            <div class="card">
              <p><strong>Order:</strong> #${order.orderNumber || order.id.slice(0, 8)}</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>No payment has been charged.</p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${siteUrl}/inventory" class="button">Continue Browsing</a>
            </div>
          </body>
        </html>
      `,
    });
    console.log(`Order rejected email sent to ${order.viewerEmail}`);
  } catch (error) {
    console.error('Failed to send order rejected email:', error);
  }
}

/**
 * Send access request notification to distributor
 */
interface AccessRequestEmailData {
  distributorEmail: string;
  distributorName: string;
  requesterEmail: string;
  requesterName?: string;
  requesterCompanyName?: string;
  requesterPhone?: string;
  requesterCity?: string;
  requesterCountry?: string;
}

export async function sendAccessRequestNotification(data: AccessRequestEmailData): Promise<void> {
  try {
    const profileRows = [
      { label: 'Email', value: data.requesterEmail },
      data.requesterName ? { label: 'Name', value: data.requesterName } : null,
      data.requesterCompanyName ? { label: 'Company', value: data.requesterCompanyName } : null,
      data.requesterPhone ? { label: 'Phone', value: data.requesterPhone } : null,
      data.requesterCity || data.requesterCountry
        ? { label: 'Location', value: [data.requesterCity, data.requesterCountry].filter(Boolean).join(', ') }
        : null,
    ].filter(Boolean) as { label: string; value: string }[];

    const profileHtml = profileRows
      .map(row => `<p><strong>${row.label}:</strong> ${row.value}</p>`)
      .join('\n              ');

    await resend.emails.send({
      from: 'Vinylogix <noreply@vinylogix.com>',
      to: data.distributorEmail,
      subject: `New Catalog Access Request from ${data.requesterCompanyName || data.requesterName || data.requesterEmail}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #dbeafe; border-radius: 8px; padding: 30px; margin-bottom: 20px; text-align: center; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .button { display: inline-block; background-color: #26222B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>New Access Request</h1>
              <p>Someone wants to browse your catalog on Vinylogix</p>
            </div>

            <div class="card">
              <h2>Requester Details</h2>
              ${profileHtml}
            </div>

            <p>You can approve or deny this request from your Clients page.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${siteUrl}/clients" class="button">Review Request</a>
            </div>

            <p style="text-align: center; color: #6c757d; font-size: 14px;">
              This email was sent because someone requested access to ${data.distributorName}'s catalog on Vinylogix.
            </p>
          </body>
        </html>
      `,
    });

    console.log(`Access request notification sent to ${data.distributorEmail}`);
  } catch (error) {
    console.error('Failed to send access request notification:', error);
  }
}

/**
 * Send confirmation to requester that their access request was submitted
 */
export async function sendAccessRequestConfirmation(
  requesterEmail: string,
  distributorName: string
): Promise<void> {
  try {
    await resend.emails.send({
      from: 'Vinylogix <noreply@vinylogix.com>',
      to: requesterEmail,
      subject: `Access Request Sent — ${distributorName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #dbeafe; border-radius: 8px; padding: 30px; margin-bottom: 20px; text-align: center; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Request Submitted</h1>
            </div>
            <div class="card">
              <p>Your access request to <strong>${distributorName}</strong>'s catalog has been submitted.</p>
              <p>The distributor will review your request and you'll receive an email once it's been approved or denied.</p>
            </div>
            <p style="text-align: center; color: #6c757d; font-size: 14px;">
              This email was sent by Vinylogix on behalf of ${distributorName}.
            </p>
          </body>
        </html>
      `,
    });
    console.log(`Access request confirmation sent to ${requesterEmail}`);
  } catch (error) {
    console.error('Failed to send access request confirmation:', error);
  }
}

/**
 * Send email to requester when their access request is approved
 */
export async function sendAccessApprovedEmail(
  requesterEmail: string,
  distributorName: string,
  storefrontSlug?: string
): Promise<void> {
  try {
    const catalogUrl = storefrontSlug
      ? `${siteUrl}/storefront/${storefrontSlug}`
      : `${siteUrl}/dashboard`;

    await resend.emails.send({
      from: 'Vinylogix <noreply@vinylogix.com>',
      to: requesterEmail,
      subject: `Access Approved — ${distributorName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #d1fae5; border-radius: 8px; padding: 30px; margin-bottom: 20px; text-align: center; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .button { display: inline-block; background-color: #26222B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Access Approved!</h1>
            </div>
            <div class="card">
              <p>Great news! <strong>${distributorName}</strong> has approved your access request.</p>
              <p>You can now browse their full catalog with prices and place orders.</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${catalogUrl}" class="button">Browse Catalog</a>
            </div>
            <p style="text-align: center; color: #6c757d; font-size: 14px;">
              This email was sent by Vinylogix on behalf of ${distributorName}.
            </p>
          </body>
        </html>
      `,
    });
    console.log(`Access approved email sent to ${requesterEmail}`);
  } catch (error) {
    console.error('Failed to send access approved email:', error);
  }
}

/**
 * Send email to requester when their access request is denied
 */
export async function sendAccessDeniedEmail(
  requesterEmail: string,
  distributorName: string
): Promise<void> {
  try {
    await resend.emails.send({
      from: 'Vinylogix <noreply@vinylogix.com>',
      to: requesterEmail,
      subject: `Access Request Update — ${distributorName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #f3f4f6; border-radius: 8px; padding: 30px; margin-bottom: 20px; text-align: center; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Access Request Update</h1>
            </div>
            <div class="card">
              <p>Unfortunately, <strong>${distributorName}</strong> was unable to approve your access request at this time.</p>
              <p>You can contact the distributor directly for more information.</p>
            </div>
            <p style="text-align: center; color: #6c757d; font-size: 14px;">
              This email was sent by Vinylogix on behalf of ${distributorName}.
            </p>
          </body>
        </html>
      `,
    });
    console.log(`Access denied email sent to ${requesterEmail}`);
  } catch (error) {
    console.error('Failed to send access denied email:', error);
  }
}

const itemStatusLabels: Record<OrderItemStatus, string> = {
  available: 'Available',
  not_available: 'Not Available',
  out_of_stock: 'Out of Stock',
  back_order: 'Back Order',
};

const itemStatusColors: Record<OrderItemStatus, string> = {
  available: '#16a34a',
  not_available: '#dc2626',
  out_of_stock: '#ea580c',
  back_order: '#d97706',
};

export async function sendOrderItemChangesEmail(order: Order, distributorName: string): Promise<void> {
  const changedItems = order.items.filter(item => item.itemStatus && item.itemStatus !== 'available');
  if (changedItems.length === 0) return;

  const itemRows = changedItems.map(item => {
    const status = item.itemStatus || 'available';
    const color = itemStatusColors[status];
    const label = itemStatusLabels[status];
    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb;">
          <strong>${item.artist}</strong> — ${item.title}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; color: white; background: ${color};">${label}</span>
        </td>
      </tr>
    `;
  }).join('');

  const hasAdjustedTotal = order.originalTotalAmount && order.originalTotalAmount !== order.totalAmount;

  try {
    await resend.emails.send({
      from: 'Vinylogix <noreply@vinylogix.com>',
      to: [order.viewerEmail],
      subject: `Order Update — ${order.orderNumber || order.id}`,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Update</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #1f2937; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 20px;">📦 Order Update</h1>
    </div>
    <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <p>Hello ${order.customerName || ''},</p>
        <p><strong>${distributorName}</strong> has updated the availability of some items in your order <strong>#${order.orderNumber || order.id}</strong>:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Item</th>
              <th style="padding: 10px 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Qty</th>
              <th style="padding: 10px 12px; text-align: center; border-bottom: 2px solid #e5e7eb;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        ${hasAdjustedTotal ? `
        <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 5px 0; font-size: 14px; color: #92400e;">
            <strong>Order total adjusted:</strong>
          </p>
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            Original: <span style="text-decoration: line-through;">€ ${formatPriceForDisplay(order.originalTotalAmount!)}</span>
            → New total: <strong>€ ${formatPriceForDisplay(order.totalAmount)}</strong>
          </p>
        </div>
        ` : ''}

        <p>If you have any questions about this update, please contact <strong>${distributorName}</strong> directly.</p>

        <a href="${siteUrl}/my-orders/${order.id}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0;">View Order Details</a>
    </div>
    <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
        <p>This email was sent from Vinylogix on behalf of ${distributorName}</p>
    </div>
</body>
</html>
      `,
      text: `
Order Update — ${order.orderNumber || order.id}

Hello ${order.customerName || ''},

${distributorName} has updated the availability of some items in your order:

${changedItems.map(item => `- ${item.artist} — ${item.title} (Qty: ${item.quantity}): ${itemStatusLabels[item.itemStatus || 'available']}`).join('\n')}

${hasAdjustedTotal ? `Order total adjusted: Original €${formatPriceForDisplay(order.originalTotalAmount!)} → New total €${formatPriceForDisplay(order.totalAmount)}` : ''}

View your order: ${siteUrl}/my-orders/${order.id}
      `,
    });
    console.log(`Order item changes email sent to ${order.viewerEmail}`);
  } catch (error) {
    console.error('Failed to send order item changes email:', error);
    throw error;
  }
}

/**
 * Sends the customer an order-approved email with the invoice PDF attached
 * but NO Stripe payment link. Used when the distributor's paymentLinkMode is
 * 'never' or they chose "Approve & Send Invoice Only" at approval time.
 * The customer pays externally (bank transfer etc.) using the payment details
 * on the invoice PDF; distributor later does Mark as Paid.
 */
export async function sendOrderApprovedInvoiceOnlyEmail(
  order: Order,
  distributorOrName: string | RenderableDistributor,
  pdfBase64: string,
  filename: string,
  replyToEmail?: string
): Promise<void> {
  // Accept either a full distributor object (preferred — enables branding +
  // payment details in the email body) or just a name (legacy callers).
  const distributor: RenderableDistributor | null =
    typeof distributorOrName === 'object' && distributorOrName !== null
      ? distributorOrName
      : null;
  const distributorName = distributor
    ? distributorDisplayName(distributor)
    : (distributorOrName as string);
  const orderRef = order.orderNumber || order.id.slice(0, 8);
  const effectiveReplyTo = replyToEmail || distributor?.contactEmail || undefined;

  const orderSummary = renderOrderSummary(order, distributor);
  const paymentSection = renderPaymentDetailsSection(distributor, orderRef);
  const viewButton = `
    <div style="padding: 8px 24px 24px 24px; background: white; text-align: center;">
      <a href="${siteUrl}/my-orders/${order.id}" style="display: inline-block; background: #111827; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 14px;">View Order Details</a>
      <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">📎 A PDF invoice is attached to this email.</p>
    </div>
  `;

  const bodyHtml = orderSummary + paymentSection + viewButton;

  const html = renderEmailShell({
    distributor,
    title: 'Your order has been approved',
    intro: `<strong>${escapeHtml(distributorName)}</strong> has approved your order. The invoice is attached as a PDF. Payment details are below — please include your order number as reference so your payment can be matched.`,
    accentColor: '#16a34a',
    bodyHtml,
  });

  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: [order.viewerEmail],
      ...(effectiveReplyTo ? { replyTo: effectiveReplyTo } : {}),
      subject: `Order Approved — Invoice #${orderRef}`,
      attachments: [{ filename, content: pdfBase64 }],
      html,
      text: `Order Approved — Invoice #${orderRef}

${distributorName} has approved your order #${orderRef}.
Total: € ${formatPriceForDisplay(order.totalAmount)}

How to pay: the invoice PDF is attached. Please transfer the total using the payment
details on the invoice and on this email, and include your order number (#${orderRef})
in the transfer reference so the payment can be matched.

Once ${distributorName} has confirmed receipt of your payment, you'll be notified and
your order will be shipped.

View your order: ${siteUrl}/my-orders/${order.id}
`,
    });
    console.log(`Order-approved invoice-only email sent to ${order.viewerEmail} for order ${orderRef}`);
  } catch (error) {
    console.error('Failed to send invoice-only approval email:', error);
    throw error;
  }
}

/**
 * Confirms to the customer that their manually-processed payment (bank
 * transfer, cash, external PayPal, etc.) has been received by the distributor.
 * Sent when the distributor clicks "Mark as Paid" with the send-confirmation
 * option enabled.
 */
export async function sendOrderPaidConfirmation(
  order: Order,
  distributorOrName: string | RenderableDistributor,
  paymentMethodLabel: string
): Promise<void> {
  const distributor: RenderableDistributor | null =
    typeof distributorOrName === 'object' && distributorOrName !== null
      ? distributorOrName
      : null;
  const distributorName = distributor ? distributorDisplayName(distributor) : (distributorOrName as string);
  const orderRef = order.orderNumber || order.id.slice(0, 8);
  const effectiveReplyTo = distributor?.contactEmail || undefined;

  const methodBadge = `
    <div style="padding: 0 24px 12px 24px; background: white;">
      <div style="display: inline-block; padding: 6px 12px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 999px; font-size: 13px; color: #065f46;">
        ✓ Paid via <strong>${escapeHtml(paymentMethodLabel)}</strong>
      </div>
    </div>
  `;
  const summary = renderOrderSummary(order, distributor);
  const cta = `
    <div style="padding: 8px 24px 24px 24px; background: white; text-align: center;">
      <a href="${siteUrl}/my-orders/${order.id}" style="display: inline-block; background: #111827; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 14px;">View Order Details</a>
      <p style="margin: 14px 0 0 0; color: #6b7280; font-size: 12px;">Your order is now being processed — you'll receive another email when it ships.</p>
    </div>
  `;
  const bodyHtml = methodBadge + summary + cta;

  const html = renderEmailShell({
    distributor,
    title: 'Payment received',
    intro: `<strong>${escapeHtml(distributorName)}</strong> has confirmed receipt of your payment for this order. Thank you!`,
    accentColor: '#16a34a',
    bodyHtml,
  });

  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: [order.viewerEmail],
      ...(effectiveReplyTo ? { replyTo: effectiveReplyTo } : {}),
      subject: `Payment Received — Order #${orderRef}`,
      html,
      text: `Payment Received — Order #${orderRef}

Hello ${order.customerName || ''},

${distributorName} has confirmed receipt of your payment for order #${orderRef}.
Payment method: ${paymentMethodLabel}
Total paid: € ${formatPriceForDisplay(order.totalAmount)}

Your order is now being processed. You'll receive another email when it ships.

View your order: ${siteUrl}/my-orders/${order.id}
`,
    });
    console.log(`Payment confirmation email sent to ${order.viewerEmail} for order ${orderRef}`);
  } catch (error) {
    console.error('Failed to send payment confirmation email:', error);
    throw error;
  }
}

/**
 * Sends the customer a new payment link after the distributor regenerated it —
 * typically because items were adjusted and the old link no longer matched
 * the current order total. Uses getBillableItems so the line list and total
 * match what Stripe will charge.
 */
export async function sendUpdatedPaymentLinkEmail(
  order: Order,
  paymentLink: string,
  distributorOrName: string | RenderableDistributor,
  invoicePdf?: { base64: string; filename: string }
): Promise<void> {
  const distributor: RenderableDistributor | null =
    typeof distributorOrName === 'object' && distributorOrName !== null
      ? distributorOrName
      : null;
  const distributorName = distributor ? distributorDisplayName(distributor) : (distributorOrName as string);
  const orderRef = order.orderNumber || order.id.slice(0, 8);
  const effectiveReplyTo = distributor?.contactEmail || undefined;

  const warning = `
    <div style="margin: 0 24px 16px 24px; padding: 12px 14px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #78350f;">
      <strong>Use this new link</strong> — any earlier payment link for this order is no longer valid.
    </div>
  `;
  const summary = renderOrderSummary(order, distributor);
  const payButton = `
    <div style="padding: 8px 24px 24px 24px; background: white; text-align: center;">
      <a href="${escapeHtml(paymentLink)}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 44px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(22,163,74,0.25);">Pay Securely</a>
      <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">This payment link expires in 24 hours.</p>
      <p style="margin: 14px 0 0 0; color: #6b7280; font-size: 12px;"><a href="${siteUrl}/my-orders/${order.id}" style="color: #6b7280;">View order details on Vinylogix</a></p>
      ${invoicePdf ? '<p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">📎 The updated invoice is attached as a PDF.</p>' : ''}
    </div>
  `;

  const bodyHtml = warning + summary + payButton;

  const html = renderEmailShell({
    distributor,
    title: 'Updated payment link',
    intro: `<strong>${escapeHtml(distributorName)}</strong> has updated your order and sent a fresh payment link. You'll be charged exactly the total shown here.`,
    accentColor: '#d97706',
    bodyHtml,
  });

  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: [order.viewerEmail],
      ...(effectiveReplyTo ? { replyTo: effectiveReplyTo } : {}),
      subject: `Updated Payment Link — Order #${orderRef}`,
      ...(invoicePdf ? { attachments: [{ filename: invoicePdf.filename, content: invoicePdf.base64 }] } : {}),
      html,
      text: `Updated Payment Link — Order #${orderRef}

Hello ${order.customerName || ''},

${distributorName} has updated your order #${orderRef} and sent a new payment link.
IMPORTANT: any earlier payment link for this order is no longer valid.

New total: € ${formatPriceForDisplay(order.totalAmount)}

Pay now: ${paymentLink}
This link expires in 24 hours.
${invoicePdf ? '\nThe updated invoice is attached as a PDF.' : ''}
`,
    });
    console.log(`Updated payment link email sent to ${order.viewerEmail} for order ${orderRef}`);
  } catch (error) {
    console.error('Failed to send updated payment link email:', error);
    throw error;
  }
}

/**
 * Sends the distributor's invoice PDF to the customer as an email attachment.
 * Used after a distributor adjusts items on an already-approved order so the
 * customer receives an up-to-date invoice reflecting the current order list.
 */
export async function sendInvoiceToCustomerEmail(
  order: Order,
  distributorOrName: string | RenderableDistributor,
  pdfBase64: string,
  filename: string,
  replyToEmail?: string
): Promise<void> {
  const distributor: RenderableDistributor | null =
    typeof distributorOrName === 'object' && distributorOrName !== null
      ? distributorOrName
      : null;
  const distributorName = distributor ? distributorDisplayName(distributor) : (distributorOrName as string);
  const orderRef = order.orderNumber || order.id.slice(0, 8);
  const effectiveReplyTo = replyToEmail || distributor?.contactEmail || undefined;

  // When the order is still awaiting payment, include the payment details
  // so the customer can act on the invoice right away (matches the
  // invoice-only approval email). For paid/shipped orders, no payment
  // details — it's just a receipt-style update.
  const showPaymentDetails =
    order.paymentStatus !== 'paid' &&
    order.status !== 'cancelled' &&
    !order.paymentLink; // skip when there's already an active Stripe link

  const summary = renderOrderSummary(order, distributor);
  const paymentSection = showPaymentDetails ? renderPaymentDetailsSection(distributor, orderRef) : '';
  const cta = `
    <div style="padding: 8px 24px 24px 24px; background: white; text-align: center;">
      <a href="${siteUrl}/my-orders/${order.id}" style="display: inline-block; background: #111827; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 14px;">View Order Details</a>
      <p style="margin: 10px 0 0 0; color: #6b7280; font-size: 12px;">📎 The updated invoice is attached as a PDF.</p>
    </div>
  `;
  const bodyHtml = summary + paymentSection + cta;

  const html = renderEmailShell({
    distributor,
    title: 'Updated invoice',
    intro: `<strong>${escapeHtml(distributorName)}</strong> has sent you an updated invoice reflecting the current order list. The PDF is attached to this email${showPaymentDetails ? '; payment details are below' : ''}.`,
    accentColor: '#2563eb',
    bodyHtml,
  });

  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <noreply@vinylogix.com>',
      to: [order.viewerEmail],
      ...(effectiveReplyTo ? { replyTo: effectiveReplyTo } : {}),
      subject: `Updated Invoice — Order #${orderRef}`,
      attachments: [{ filename, content: pdfBase64 }],
      html,
      text: `Updated Invoice — Order #${orderRef}

Hello ${order.customerName || ''},

${distributorName} has sent you an updated invoice for order #${orderRef}.
Total: € ${formatPriceForDisplay(order.totalAmount)}
${showPaymentDetails ? `\nPlease transfer the total using the payment details on the attached invoice and include #${orderRef} as reference.\n` : ''}
View your order: ${siteUrl}/my-orders/${order.id}
`,
    });
    console.log(`Invoice email sent to ${order.viewerEmail} for order ${orderRef}`);
  } catch (error) {
    console.error('Failed to send invoice email:', error);
    throw error;
  }
}

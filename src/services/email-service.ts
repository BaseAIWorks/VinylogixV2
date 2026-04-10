import { resend } from '@/lib/resend';
import { format } from 'date-fns';
import type { Order, OrderItemStatus } from '@/types';
import { formatPriceForDisplay } from '@/lib/utils';
import { markdownToSafeHtml, escapeHtml } from '@/lib/markdown-utils';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://vinylogix.com';

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
  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <orders@vinylogix.com>',
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
              ${order.items.map(item => `
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
              <a href="${siteUrl}/my-orders/${order.id}" class="button">View Order Details</a>
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
 * Send shipping notification to client
 */
export async function sendShippingNotification(order: Order): Promise<void> {
  if (!order.trackingNumber) return;

  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <orders@vinylogix.com>',
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
              <a href="${siteUrl}/my-orders/${order.id}" class="button" style="margin-left: 10px;">View Order</a>
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
      from: 'Vinylogix Orders <orders@vinylogix.com>',
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
 * Send order request confirmation to client (awaiting approval)
 */
export async function sendOrderRequestConfirmation(order: Order): Promise<void> {
  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <orders@vinylogix.com>',
      to: order.viewerEmail,
      subject: `Order Request Received #${order.orderNumber || order.id.slice(0, 8)}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #fef3c7; border-radius: 8px; padding: 30px; margin-bottom: 20px; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .item { padding: 12px 0; border-bottom: 1px solid #e9ecef; }
              .total { padding: 16px 0; font-size: 18px; font-weight: 700; }
              .button { display: inline-block; background-color: #26222B; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Order Request Received</h1>
              <p>Your order has been submitted and is awaiting approval from the seller. You will receive an email once it has been reviewed.</p>
            </div>

            <div class="card">
              <h2>Order Details</h2>
              <p><strong>Order Number:</strong> ${order.orderNumber || order.id.slice(0, 8)}</p>
              <p><strong>Date:</strong> ${format(new Date(order.createdAt), 'PPP')}</p>
              <p><strong>Status:</strong> Awaiting Approval</p>
            </div>

            <div class="card">
              <h2>Items</h2>
              ${order.items.map(item => `
                <div class="item">
                  <p style="margin: 0; font-weight: 600;">${item.artist} – ${item.title}</p>
                  <p style="margin: 0; color: #6c757d;">Qty: ${item.quantity} · €${formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}</p>
                </div>
              `).join('')}
              <div class="total">Total: €${formatPriceForDisplay(order.totalAmount)}</div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${siteUrl}/my-orders/${order.id}" class="button">View Order Status</a>
            </div>

            <p style="text-align: center; color: #6c757d; font-size: 14px;">
              No payment is required at this time. You will be notified when the seller has reviewed your order.
            </p>
          </body>
        </html>
      `,
    });
    console.log(`Order request confirmation sent to ${order.viewerEmail}`);
  } catch (error) {
    console.error('Failed to send order request confirmation:', error);
  }
}

/**
 * Send order request notification to distributor (new request to review)
 */
export async function sendOrderRequestNotification(order: Order, distributorEmail: string): Promise<void> {
  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <orders@vinylogix.com>',
      to: distributorEmail,
      subject: `New Order Request #${order.orderNumber || order.id.slice(0, 8)} — Action Required`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #fef3c7; border-radius: 8px; padding: 30px; margin-bottom: 20px; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .item { padding: 12px 0; border-bottom: 1px solid #e9ecef; }
              .total { padding: 16px 0; font-size: 18px; font-weight: 700; }
              .button { display: inline-block; background-color: #d69a2e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>New Order Request</h1>
              <p>A client has submitted an order request that requires your approval.</p>
            </div>

            <div class="card">
              <h2>Customer</h2>
              <p><strong>${order.customerName}</strong></p>
              <p>${order.viewerEmail}</p>
              ${order.customerCompanyName ? `<p>${order.customerCompanyName}</p>` : ''}
            </div>

            <div class="card">
              <h2>Order #${order.orderNumber || order.id.slice(0, 8)}</h2>
              ${order.items.map(item => `
                <div class="item">
                  <p style="margin: 0; font-weight: 600;">${item.artist} – ${item.title}</p>
                  <p style="margin: 0; color: #6c757d;">Qty: ${item.quantity} · €${formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}</p>
                </div>
              `).join('')}
              <div class="total">Total: €${formatPriceForDisplay(order.totalAmount)}</div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${siteUrl}/orders/${order.id}" class="button">Review & Approve Order</a>
            </div>

            <p style="text-align: center; color: #6c757d; font-size: 14px;">
              You can approve or reject this order from the order detail page.
            </p>
          </body>
        </html>
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
export async function sendOrderApprovedEmail(order: Order, paymentLink?: string): Promise<void> {
  try {
    await resend.emails.send({
      from: 'Vinylogix Orders <orders@vinylogix.com>',
      to: order.viewerEmail,
      subject: `Order Approved #${order.orderNumber || order.id.slice(0, 8)} — Payment Required`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #d1fae5; border-radius: 8px; padding: 30px; margin-bottom: 20px; }
              .card { background-color: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
              .item { padding: 12px 0; border-bottom: 1px solid #e9ecef; }
              .total { padding: 16px 0; font-size: 18px; font-weight: 700; }
              .button { display: inline-block; background-color: #16a34a; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; }
              .button-secondary { display: inline-block; background-color: #26222B; color: white; padding: 10px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Your Order Has Been Approved!</h1>
              <p>Great news — the seller has approved your order. Please complete your payment to proceed.</p>
            </div>

            <div class="card">
              <h2>Order #${order.orderNumber || order.id.slice(0, 8)}</h2>
              ${order.items.map(item => `
                <div class="item">
                  <p style="margin: 0; font-weight: 600;">${item.artist} – ${item.title}</p>
                  <p style="margin: 0; color: #6c757d;">Qty: ${item.quantity} · €${formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}</p>
                </div>
              `).join('')}
              <div class="total">Total: €${formatPriceForDisplay(order.totalAmount)}</div>
            </div>

            ${paymentLink ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${paymentLink}" class="button">Pay Now</a>
              </div>
              <p style="text-align: center; color: #6c757d; font-size: 13px;">
                This payment link expires in 24 hours.
              </p>
            ` : ''}

            <div style="text-align: center; margin: 20px 0;">
              <a href="${siteUrl}/my-orders/${order.id}" class="button-secondary">View Order Details</a>
            </div>
          </body>
        </html>
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
      from: 'Vinylogix Orders <orders@vinylogix.com>',
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

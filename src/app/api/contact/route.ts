import { NextRequest, NextResponse } from 'next/server';
import { resend } from '@/lib/resend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, subject, message } = body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Send email to contact@vinylogix.com
    await resend.emails.send({
      from: 'Vinylogix Contact <noreply@vinylogix.com>',
      to: 'contact@vinylogix.com',
      replyTo: email,
      subject: `[Contact Form] ${subject}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1f2937; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
              .field { margin-bottom: 20px; }
              .label { font-weight: bold; color: #4b5563; margin-bottom: 5px; }
              .value { background: white; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
              .message { white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>New Contact Form Submission</h1>
            </div>

            <div class="content">
              <div class="field">
                <div class="label">From:</div>
                <div class="value">${name} &lt;${email}&gt;</div>
              </div>

              <div class="field">
                <div class="label">Subject:</div>
                <div class="value">${subject}</div>
              </div>

              <div class="field">
                <div class="label">Message:</div>
                <div class="value message">${message.replace(/\n/g, '<br>')}</div>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `
New Contact Form Submission

From: ${name} <${email}>
Subject: ${subject}

Message:
${message}
      `,
    });

    // Send confirmation email to the user
    await resend.emails.send({
      from: 'Vinylogix <noreply@vinylogix.com>',
      to: email,
      subject: 'We received your message - Vinylogix',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1f2937; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; }
              .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Thank you for contacting us!</h1>
            </div>

            <div class="content">
              <p>Hi ${name},</p>

              <p>We've received your message and will get back to you as soon as possible, typically within 24-48 hours.</p>

              <p>Here's a copy of your message:</p>

              <blockquote style="background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0;">
                <strong>Subject:</strong> ${subject}<br><br>
                ${message.replace(/\n/g, '<br>')}
              </blockquote>

              <p>Best regards,<br>The Vinylogix Team</p>
            </div>

            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Vinylogix. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
      text: `
Hi ${name},

Thank you for contacting us! We've received your message and will get back to you as soon as possible, typically within 24-48 hours.

Here's a copy of your message:

Subject: ${subject}

${message}

Best regards,
The Vinylogix Team
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Failed to send message. Please try again later.' },
      { status: 500 }
    );
  }
}

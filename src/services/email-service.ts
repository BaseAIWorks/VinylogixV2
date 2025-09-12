import { resend } from '@/lib/resend';

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
}

interface ExistingAccountEmailData {
  clientEmail: string;
  distributor: DistributorInfo;
  websiteUrl: string;
}

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
      `,
    });

    console.log('Existing account invitation email sent:', result.data?.id);
    return result;
  } catch (error) {
    console.error('Failed to send existing account invitation email:', error);
    throw error;
  }
}

import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { config } from '../config/index.js';
import { Resend } from 'resend';

let transporter: Transporter | null = null;

function ensureTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const user = config.SMTP2GO_USERNAME;
  const pass = config.SMTP2GO_PASSWORD || config.SMTP2GO_API_KEY;

  console.log('Initializing SMTP2GO transporter with config:', {
    host: process.env.SMTP2GO_HOST || 'mail.smtp2go.com',
    port: Number(process.env.SMTP2GO_PORT || 2525),
    hasUsername: !!user,
    hasPassword: !!pass,
    usernameLength: user?.length,
    secure: false,
    requireTLS: true
  });

  if (!user || !pass) {
    const error = new Error('SMTP2GO credentials are not configured. Please set SMTP2GO_USERNAME and SMTP2GO_PASSWORD environment variables.');
    console.error('SMTP Configuration Error:', error.message);
    throw error;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP2GO_HOST || 'mail.smtp2go.com',
    port: Number(process.env.SMTP2GO_PORT || 2525),
    secure: false,
    requireTLS: true,
    auth: {
      user,
      pass
    },
    debug: process.env.NODE_ENV !== 'production', // Enable debug in development
    logger: process.env.NODE_ENV !== 'production' // Enable logging in development
  });

  console.log('SMTP2GO transporter created successfully');
  return transporter;
}

async function sendEmail(options: SendMailOptions): Promise<void> {
  const senderEmail = config.FROM_EMAIL || config.CONTACT_FORM_RECIPIENT || config.SMTP2GO_USERNAME;
  if (!senderEmail) {
    const error = new Error('FROM_EMAIL is not configured. Please set FROM_EMAIL environment variable.');
    console.error('Email Configuration Error:', error.message);
    throw error;
  }

  const senderName = config.FROM_NAME || 'SkyVPS360';
  const mailOptions: SendMailOptions = {
    from: options.from || `${senderName} <${senderEmail}>`,
    ...options
  };

  // If Resend is configured, try to send with Resend first
  if (config.RESEND_API_KEY) {
    const resend = new Resend(config.RESEND_API_KEY);

    try {
      console.log('Attempting to send email via Resend to:', mailOptions.to);
      const { data, error } = await resend.emails.send({
        from: mailOptions.from as string,
        to: Array.isArray(mailOptions.to) ? mailOptions.to as string[] : [mailOptions.to as string],
        subject: mailOptions.subject as string || '',
        html: mailOptions.html as string || '',
        text: mailOptions.text as string || ''
      });

      if (error) {
        console.error('Failed to send email via Resend (falling back to SMTP):', error);
      } else {
        console.log('Email sent via Resend successfully:', data);
        return;
      }
    } catch (error) {
      console.error('Exception sending via Resend (falling back to SMTP):', error);
    }
  }

  // Fallback to standard SMTP2GO sender

  console.log('Attempting to send email:', {
    to: mailOptions.to,
    from: mailOptions.from,
    subject: mailOptions.subject,
    hasHtml: !!mailOptions.html,
    hasText: !!mailOptions.text
  });

  try {
    const transport = ensureTransporter();
    const info = await transport.sendMail(mailOptions);
    console.log('Email sent successfully:', {
      messageId: info.messageId,
      response: info.response,
      to: mailOptions.to
    });
  } catch (error) {
    console.error('Failed to send email:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      to: mailOptions.to,
      from: mailOptions.from
    });
    throw error;
  }
}

export async function sendWelcomeEmail(to: string, name?: string): Promise<void> {
  const displayName = name || 'there';
  const subject = 'Welcome to SkyVPS360';
  const html = `
    <p>Hi ${displayName},</p>
    <p>Welcome to SkyVPS360. Your account is ready to go.</p>
    <p>If you did not create this account, please contact support right away.</p>
    <p>Thanks,<br/>The SkyVPS360 Team</p>
  `;
  const text = `Hi ${displayName},\n\nWelcome to SkyVPS360. Your account is ready to go.\n\nIf you did not create this account, please contact support right away.\n\nThanks,\nThe SkyVPS360 Team`;

  await sendEmail({ to, subject, html, text });
}

export async function sendLoginNotificationEmail(to: string, name?: string): Promise<void> {
  const displayName = name || 'there';
  const subject = 'SkyVPS360 login notification';
  const html = `
    <p>Hi ${displayName},</p>
    <p>We noticed a successful login to your SkyVPS360 account just now.</p>
    <p>If this was not you, we recommend resetting your password immediately.</p>
    <p>Thanks,<br/>The SkyVPS360 Team</p>
  `;
  const text = `Hi ${displayName},\n\nWe noticed a successful login to your SkyVPS360 account just now.\n\nIf this was not you, we recommend resetting your password immediately.\n\nThanks,\nThe SkyVPS360 Team`;

  await sendEmail({ to, subject, html, text });
}

export async function sendPasswordResetEmail(to: string, token: string, name?: string): Promise<void> {
  const baseUrl = (config.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const resetPageUrl = `${baseUrl}/reset-password`;
  const displayName = name || 'there';
  const subject = 'Reset your SkyVPS360 password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Hi ${displayName},</p>
      <p>We received a request to reset your SkyVPS360 password.</p>
      <p>Enter this 8-digit reset code on the password reset page:</p>
      <div style="background: #f5f5f5; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em; margin: 0; font-family: 'Courier New', monospace;">${token}</p>
      </div>
      <p>This code will expire in <strong>one hour</strong>.</p>
      <p>Go to <a href="${resetPageUrl}" style="color: #0066cc;">${resetPageUrl}</a> and enter:</p>
      <ol style="line-height: 1.8;">
        <li>Your email address: <strong>${to}</strong></li>
        <li>The 8-digit code above</li>
        <li>Your new password</li>
      </ol>
      <p style="color: #666; font-size: 14px; margin-top: 30px;">If you did not request this password reset, you can safely ignore this email. Your password will not be changed.</p>
      <p style="margin-top: 30px;">Thanks,<br/><strong>The SkyVPS360 Team</strong></p>
    </div>
  `;
  const text = `Hi ${displayName},

We received a request to reset your SkyVPS360 password.

Your 8-digit reset code (valid for 1 hour):

${token}

To reset your password:
1. Go to ${resetPageUrl}
2. Enter your email address: ${to}
3. Enter the 8-digit code above
4. Choose your new password

If you did not request this password reset, you can safely ignore this email. Your password will not be changed.

Thanks,
The SkyVPS360 Team`;

  await sendEmail({ to, subject, html, text });
}
export interface ContactEmailOptions {
  to: string;
  from: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export async function sendContactEmail({ to, from, subject, text, html, replyTo }: ContactEmailOptions): Promise<void> {
  await sendEmail({ to, from, subject, text, html, replyTo });
}

import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { Resend } from "resend";
import { config, type EmailProvider } from "../config/index.js";

let transporter: Transporter | null = null;

const logPrefix = "[EmailService]";

function ensureTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const host = config.SMTP_HOST;
  const port = config.SMTP_PORT || 587;
  const user = config.SMTP_USERNAME;
  const pass = config.SMTP_PASSWORD;

  console.log(`${logPrefix} Initializing SMTP transporter with config:`, {
    host,
    port,
    hasUsername: !!user,
    hasPassword: !!pass,
    secure: config.SMTP_SECURE,
    requireTLS: config.SMTP_REQUIRE_TLS,
  });

  if (!host || !user || !pass) {
    const error = new Error(
      "SMTP credentials are not fully configured. Please set SMTP_HOST, SMTP_USERNAME, and SMTP_PASSWORD environment variables.",
    );
    console.error(`${logPrefix} SMTP Configuration Error:`, error.message);
    throw error;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: config.SMTP_SECURE,
    requireTLS: config.SMTP_REQUIRE_TLS,
    auth: {
      user,
      pass,
    },
    debug: process.env.NODE_ENV !== "production",
    logger: process.env.NODE_ENV !== "production",
  });

  console.log(`${logPrefix} SMTP transporter created successfully`);
  return transporter;
}

function normalizeRecipients(
  recipients: SendMailOptions["to"],
): string[] {
  if (!recipients) {
    return [];
  }
  return Array.isArray(recipients)
    ? (recipients as string[])
    : [recipients as string];
}

async function sendViaResend(mailOptions: SendMailOptions): Promise<void> {
  if (!config.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(config.RESEND_API_KEY);
  console.log(`${logPrefix} Attempting to send via Resend`, {
    to: mailOptions.to,
  });

  const { data, error } = await resend.emails.send({
    from: mailOptions.from as string,
    to: normalizeRecipients(mailOptions.to),
    subject: (mailOptions.subject as string) || "",
    html: (mailOptions.html as string) || "",
    text: (mailOptions.text as string) || "",
  });

  if (error) {
    throw error;
  }

  console.log(`${logPrefix} Email sent via Resend successfully`, data);
}

async function sendViaSmtp(mailOptions: SendMailOptions): Promise<void> {
  console.log(`${logPrefix} Attempting to send via SMTP`, {
    to: mailOptions.to,
    from: mailOptions.from,
    subject: mailOptions.subject,
    hasHtml: !!mailOptions.html,
    hasText: !!mailOptions.text,
  });

  const transport = ensureTransporter();
  const info = await transport.sendMail(mailOptions);
  console.log(`${logPrefix} Email sent via SMTP successfully`, {
    messageId: info.messageId,
    response: info.response,
    to: mailOptions.to,
  });
}

async function attemptProvider(
  provider: EmailProvider,
  mailOptions: SendMailOptions,
): Promise<void> {
  if (provider === "resend") {
    if (!config.RESEND_API_KEY) {
      throw new Error("Resend provider selected but RESEND_API_KEY is missing");
    }
    await sendViaResend(mailOptions);
    return;
  }

  if (provider === "smtp") {
    if (!config.SMTP_HOST || !config.SMTP_USERNAME || !config.SMTP_PASSWORD) {
      throw new Error(
        "SMTP provider selected but SMTP_HOST/SMTP_USERNAME/SMTP_PASSWORD are missing",
      );
    }
    await sendViaSmtp(mailOptions);
    return;
  }

  throw new Error(`Unsupported email provider: ${provider}`);
}

async function sendEmail(options: SendMailOptions): Promise<void> {
  const senderEmail =
    config.FROM_EMAIL ||
    config.CONTACT_FORM_RECIPIENT ||
    config.SMTP_USERNAME;
  if (!senderEmail) {
    const error = new Error(
      "FROM_EMAIL is not configured. Please set FROM_EMAIL environment variable.",
    );
    console.error("Email Configuration Error:", error.message);
    throw error;
  }

  const senderName = config.FROM_NAME || config.COMPANY_BRAND_NAME || "SkyVPS360";
  const mailOptions: SendMailOptions = {
    from: options.from || `${senderName} <${senderEmail}>`,
    ...options,
  };

  const attempts: { provider: EmailProvider; error: unknown }[] = [];
  for (const provider of config.EMAIL_PROVIDER_PRIORITY) {
    try {
      await attemptProvider(provider, mailOptions);
      return;
    } catch (error) {
      attempts.push({ provider, error });
      console.error(`${logPrefix} Provider '${provider}' failed`, error);
    }
  }

  const errorSummary = attempts
    .map(({ provider, error }) => `${provider}: ${error instanceof Error ? error.message : String(error)}`)
    .join(" | ");

  throw new Error(`All email providers failed. Details: ${errorSummary}`);
}

export async function sendWelcomeEmail(
  to: string,
  name?: string,
): Promise<void> {
  const displayName = name || "there";
  const subject = "Welcome to SkyVPS360";
  const html = `
    <p>Hi ${displayName},</p>
    <p>Welcome to SkyVPS360. Your account is ready to go.</p>
    <p>If you did not create this account, please contact support right away.</p>
    <p>Thanks,<br/>The SkyVPS360 Team</p>
  `;
  const text = `Hi ${displayName},\n\nWelcome to SkyVPS360. Your account is ready to go.\n\nIf you did not create this account, please contact support right away.\n\nThanks,\nThe SkyVPS360 Team`;

  await sendEmail({ to, subject, html, text });
}

export interface InvitationEmailData {
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  role: string;
  token: string;
  invitedEmail: string;
  expiresAt: string;
}

export async function sendInvitationEmail(
  invitationData: InvitationEmailData
): Promise<void> {
  const baseUrl = (config.CLIENT_URL || "http://localhost:5173").replace(/\/$/, "");
  const invitationLink = `${baseUrl}/organizations/invitations/${invitationData.token}`;
  const acceptLink = `${baseUrl}/organizations/invitations/${invitationData.token}`;
  const declineLink = `${baseUrl}/organizations/invitations/${invitationData.token}?action=decline`;

  const subject = `You've been invited to join ${invitationData.organizationName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px;">
      <div style="background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="color: #1f2937; margin-top: 0;">You've been invited to join ${invitationData.organizationName}</h2>
        
        <p>Hi there,</p>
        
        <p><strong>${invitationData.inviterName}</strong> (${invitationData.inviterEmail}) has invited you to join <strong>${invitationData.organizationName}</strong> as a <strong>${invitationData.role}</strong>.</p>
        
        ${invitationData.organizationName ? `
        <div style="background-color: #f3f4f6; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #374151;">
            <strong>Organization:</strong> ${invitationData.organizationName}<br>
            <strong>Role:</strong> ${invitationData.role}<br>
            <strong>Invited by:</strong> ${invitationData.inviterName}
          </p>
        </div>
        ` : ''}
        
        <p>You have two options:</p>

        <table role="presentation" style="width: 100%; border-collapse: separate; border-spacing: 0 10px; margin: 20px 0;">
          <tr>
            <td style="text-align: center;">
              <a href="${acceptLink}" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
                View Invitation & Accept
              </a>
            </td>
          </tr>
          <tr>
            <td style="text-align: center;">
              <a href="${declineLink}" style="display: inline-block; background-color: white; color: #6b7280; padding: 12px 24px; text-decoration: none; border: 1px solid #d1d5db; border-radius: 6px; font-weight: 600;">
                Decline Invitation
              </a>
            </td>
          </tr>
        </table>
        
        <p style="color: #6b7280; font-size: 14px;">
          This invitation will expire on <strong>${new Date(invitationData.expiresAt).toLocaleDateString()}</strong> (7 days from now).
        </p>
        
        <p style="color: #6b7280; font-size: 14px;">
          If the buttons above don't work, you can copy and paste these links into your browser:
        </p>
        
        <p style="color: #6b7280; font-size: 12px; word-break: break-all;">
          View Invitation: ${invitationLink}<br>
          Decline Directly: ${declineLink}
        </p>
        
        <p style="color: #6b7280; font-size: 14px;">
          If you didn't expect this invitation, you can safely ignore this email.
        </p>
        
        <p style="margin-top: 30px;">Thanks,<br/><strong>The ${config.COMPANY_BRAND_NAME} Team</strong></p>
      </div>
    </div>
  `;

  const text = `You've been invited to join ${invitationData.organizationName}

Hi there,

${invitationData.inviterName} (${invitationData.inviterEmail}) has invited you to join ${invitationData.organizationName} as a ${invitationData.role}.

Organization: ${invitationData.organizationName}
Role: ${invitationData.role}
Invited by: ${invitationData.inviterName}

You have two options:

1. View Invitation & Accept: ${invitationLink}
2. Decline Invitation: ${declineLink}

This invitation will expire on ${new Date(invitationData.expiresAt).toLocaleDateString()} (7 days from now).

If the links above don't work, you can copy and paste them into your browser.

If you didn't expect this invitation, you can safely ignore this email.

Thanks,
The ${config.COMPANY_BRAND_NAME} Team`;

  await sendEmail({ 
    to: invitationData.invitedEmail, 
    subject, 
    html, 
    text 
  });
}

export async function sendLoginNotificationEmail(
  to: string,
  name?: string,
): Promise<void> {
  const displayName = name || "there";
  const subject = "SkyVPS360 login notification";
  const html = `
    <p>Hi ${displayName},</p>
    <p>We noticed a successful login to your SkyVPS360 account just now.</p>
    <p>If this was not you, we recommend resetting your password immediately.</p>
    <p>Thanks,<br/>The SkyVPS360 Team</p>
  `;
  const text = `Hi ${displayName},\n\nWe noticed a successful login to your SkyVPS360 account just now.\n\nIf this was not you, we recommend resetting your password immediately.\n\nThanks,\nThe SkyVPS360 Team`;

  await sendEmail({ to, subject, html, text });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  name?: string,
): Promise<void> {
  const baseUrl = (config.CLIENT_URL || "http://localhost:5173").replace(
    /\/$/,
    "",
  );
  const resetPageUrl = `${baseUrl}/reset-password`;
  const displayName = name || "there";
  const subject = "Reset your SkyVPS360 password";
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

export async function sendContactEmail({
  to,
  from,
  subject,
  text,
  html,
  replyTo,
}: ContactEmailOptions): Promise<void> {
  await sendEmail({ to, from, subject, text, html, replyTo });
}

export interface AccountNotificationEmailOptions {
  to: string;
  name?: string;
  category: "general" | "security" | "billing" | "maintenance";
  title: string;
  message: string;
  eventType: string;
  occurredAt?: string;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export async function sendAccountNotificationEmail({
  to,
  name,
  category,
  title,
  message,
  eventType,
  occurredAt,
}: AccountNotificationEmailOptions): Promise<void> {
  const displayName = name || "there";
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeEventType = escapeHtml(eventType);
  const safeTimestamp = escapeHtml(occurredAt || new Date().toISOString());

  const subject = `SkyVPS360 alert: ${title}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto;">
      <p>Hi ${escapeHtml(displayName)},</p>
      <p>You have a new <strong>${escapeHtml(category)}</strong> alert from SkyVPS360.</p>
      <div style="border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0; font-weight: 700;">${safeTitle}</p>
        <p style="margin: 0 0 8px 0;">${safeMessage}</p>
        <p style="margin: 0; color: #4b5563; font-size: 12px;">Event: ${safeEventType}</p>
        <p style="margin: 4px 0 0 0; color: #4b5563; font-size: 12px;">Time: ${safeTimestamp}</p>
      </div>
      <p style="color: #4b5563; font-size: 14px;">
        You can manage alert categories in your account settings.
      </p>
      <p>Thanks,<br/><strong>The SkyVPS360 Team</strong></p>
    </div>
  `;

  const text = `Hi ${displayName},

You have a new ${category} alert from SkyVPS360.

${title}
${message}
Event: ${eventType}
Time: ${occurredAt || new Date().toISOString()}

You can manage alert categories in your account settings.

Thanks,
The SkyVPS360 Team`;

  await sendEmail({ to, subject, html, text });
}

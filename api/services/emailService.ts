import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { Resend } from "resend";
import { config, type EmailProvider } from "../config/index.js";
import { renderTemplate } from "./emailTemplateService.js";

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

export async function sendEmail(options: SendMailOptions): Promise<void> {
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

  const senderName = config.FROM_NAME || config.COMPANY_BRAND_NAME;
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
      console.error(`${logPrefix} Provider '${provider}' failed:`, {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        provider
      });
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
  
  const { subject, html, text } = await renderTemplate("welcome_email", {
    name: displayName,
    company_name: config.COMPANY_BRAND_NAME,
  });

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
  const formattedExpiresAt = new Date(invitationData.expiresAt).toLocaleDateString();

  const { subject, html, text } = await renderTemplate("invitation", {
    ...invitationData,
    invitationLink,
    acceptLink,
    declineLink,
    formattedExpiresAt,
    company_name: config.COMPANY_BRAND_NAME,
  });

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
  
  const { subject, html, text } = await renderTemplate("login_notification", {
    name: displayName,
    company_name: config.COMPANY_BRAND_NAME,
  });

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
  
  const { subject, html, text } = await renderTemplate("password_reset", {
    name: displayName,
    token,
    resetPageUrl,
    email: to,
    company_name: config.COMPANY_BRAND_NAME,
  });

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

/**
 * @deprecated Use sendContactFormEmail for contact form submissions.
 */
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

export interface ContactFormEmailData {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  sentAt: string;
}

export async function sendContactFormEmail(
  to: string,
  data: ContactFormEmailData,
  replyTo?: string,
): Promise<void> {
  const { subject, html, text } = await renderTemplate("contact_form", {
    ...data,
    company_name: config.COMPANY_BRAND_NAME,
  });

  const senderEmail = config.FROM_EMAIL || config.CONTACT_FORM_RECIPIENT;
  const senderName = config.FROM_NAME || config.COMPANY_BRAND_NAME;
  const from = `${senderName} Contact Form <${senderEmail}>`;

  await sendEmail({
    to,
    from,
    subject,
    text,
    html,
    replyTo,
  });
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
  
  const { subject, html, text } = await renderTemplate("account_notification", {
    name: displayName,
    category,
    title,
    message,
    eventType,
    occurredAt: occurredAt || new Date().toISOString(),
    company_name: config.COMPANY_BRAND_NAME,
  });

  await sendEmail({ to, subject, html, text });
}

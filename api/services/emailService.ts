import nodemailer, { type SendMailOptions, type Transporter } from "nodemailer";
import { Resend } from "resend";
import { config, type EmailProvider } from "../config/index.js";
import { query } from "../lib/database.js";
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

  console.log('[EmailService] Initializing SMTP transporter with config:', {
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
    console.error('[EmailService] SMTP Configuration Error:', error.message);
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
    debug: config.NODE_ENV !== "production",
    logger: config.NODE_ENV !== "production",
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
  console.log('[EmailService] Attempting to send via Resend', {
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

  console.log('[EmailService] Email sent via Resend successfully', data);
}

async function sendViaSmtp(mailOptions: SendMailOptions): Promise<void> {
  console.log('[EmailService] Attempting to send via SMTP', {
    to: mailOptions.to,
    from: mailOptions.from,
    subject: mailOptions.subject,
    hasHtml: !!mailOptions.html,
    hasText: !!mailOptions.text,
  });

  const transport = ensureTransporter();
  const info = await transport.sendMail(mailOptions);
  console.log('[EmailService] Email sent via SMTP successfully', {
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
  // Test-mode guardrail: never make real email provider calls from the test
  // suite. Tests that need to assert on email dispatch should vi.mock the
  // specific sender (sendWelcomeEmail, sendPasswordResetEmail, etc.) or spy on
  // this function directly. Rationale: unconfigured/misconfigured providers in
  // CI machines can block for 10+ seconds, producing flaky, slow test runs.
  if (config.NODE_ENV === "test") {
    console.log('[EmailService] [test-mode] Suppressed email send', {
      to: options.to,
      subject: options.subject,
    });
    return;
  }

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
      console.error('[EmailService] Provider failed:', {
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
  const companyName = config.COMPANY_BRAND_NAME;
  
  const { subject, html, text } = await renderTemplate("welcome", {
    displayName,
    companyName,
  });

  await sendEmail({ to, subject, html, text });
}

export async function sendEnhanceCredentialsEmail(input: {
  to: string;
  displayName?: string;
  firstName?: string;
  organizationName: string;
  password: string;
  panelUrl?: string;
}): Promise<void> {
  const displayName = input.displayName || input.firstName || "there";
  const companyName = config.COMPANY_BRAND_NAME;
  const panelUrl = (input.panelUrl || config.ENHANCE_API_URL || "").replace(/\/$/, "");

  await sendTemplate("hosting_credentials", input.to, {
    companyName,
    displayName,
    organizationName: input.organizationName,
    panelUrl,
    to: input.to,
    password: input.password,
  });
}

export async function resolveUserEmailAndName(
  userId: string,
): Promise<{ email: string; displayName: string } | null> {
  const result = await query("SELECT email, name FROM users WHERE id = $1 LIMIT 1", [userId]);
  if (result.rows.length === 0) {
    return null;
  }
  const user = result.rows[0];
  const email = typeof user.email === "string" ? user.email.trim() : "";
  if (!email) {
    return null;
  }
  const displayName =
    typeof user.name === "string" && user.name.trim().length > 0
      ? user.name.trim()
      : "there";
  return { email, displayName };
}

export async function sendHostingWelcomeEmail(options: {
  to: string;
  displayName?: string;
  domain: string;
  planName: string;
  primaryIp?: string | null;
  panelUrl?: string;
}): Promise<void> {
  const companyName = config.COMPANY_BRAND_NAME;
  const panelUrl = (options.panelUrl || config.ENHANCE_API_URL || "").replace(/\/$/, "");

  await sendTemplate("hosting_welcome", options.to, {
    companyName,
    displayName: options.displayName || "there",
    domain: options.domain,
    planName: options.planName,
    primaryIp: options.primaryIp || null,
    panelUrl,
  });
}

export async function sendHostingSuspendedEmail(options: {
  to: string;
  displayName?: string;
  domain: string;
  planName?: string;
  reason: string;
}): Promise<void> {
  const companyName = config.COMPANY_BRAND_NAME;

  await sendTemplate("hosting_suspended", options.to, {
    companyName,
    displayName: options.displayName || "there",
    domain: options.domain,
    planName: options.planName || "your plan",
    reason: options.reason,
  });
}

export async function sendHostingRecoveryEmail(options: {
  to: string;
  displayName?: string;
  domain: string;
  planName?: string;
}): Promise<void> {
  const companyName = config.COMPANY_BRAND_NAME;

  await sendTemplate("hosting_recovered", options.to, {
    companyName,
    displayName: options.displayName || "there",
    domain: options.domain,
    planName: options.planName || "your plan",
  });
}

export async function sendHostingCancelledEmail(options: {
  to: string;
  displayName?: string;
  domain: string;
  refundAmount?: number | null;
  refundCurrency?: string;
}): Promise<void> {
  const companyName = config.COMPANY_BRAND_NAME;

  await sendTemplate("hosting_cancelled", options.to, {
    companyName,
    displayName: options.displayName || "there",
    domain: options.domain,
    refundAmount: options.refundAmount ?? null,
    refundCurrency: options.refundCurrency || "USD",
  });
}

export async function sendHostingRenewalEmail(options: {
  to: string;
  displayName?: string;
  domain: string;
  amount: number;
  currency: string;
  nextBillingDate: string;
  invoiceId?: string | null;
}): Promise<void> {
  const companyName = config.COMPANY_BRAND_NAME;

  await sendTemplate("hosting_renewal", options.to, {
    companyName,
    displayName: options.displayName || "there",
    domain: options.domain,
    amount: options.amount,
    currency: options.currency,
    nextBillingDate: options.nextBillingDate,
    invoiceId: options.invoiceId || null,
  });
}

export async function sendHostingSuspensionWarningEmail(options: {
  to: string;
  displayName?: string;
  domain: string;
  currentBalance: number;
  requiredAmount: number;
  currency: string;
  nextBillingDate: string;
}): Promise<void> {
  const companyName = config.COMPANY_BRAND_NAME;

  await sendTemplate("hosting_suspension_warning", options.to, {
    companyName,
    displayName: options.displayName || "there",
    domain: options.domain,
    currentBalance: options.currentBalance,
    requiredAmount: options.requiredAmount,
    currency: options.currency,
    nextBillingDate: options.nextBillingDate,
  });
}

export async function sendHostingAdminActionEmail(options: {
  to: string;
  displayName?: string;
  domain: string;
  action: "suspended" | "unsuspended";
  reason?: string | null;
}): Promise<void> {
  const companyName = config.COMPANY_BRAND_NAME;

  await sendTemplate("hosting_admin_action", options.to, {
    companyName,
    displayName: options.displayName || "there",
    domain: options.domain,
    action: options.action,
    reason: options.reason || null,
  });
}

export async function sendTemplate(
  templateName: string,
  to: string,
  data: Record<string, any>,
): Promise<void> {
  const { subject, html, text } = await renderTemplate(templateName, data);
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
  const companyName = config.COMPANY_BRAND_NAME;

  const { subject, html, text } = await renderTemplate("invitation", {
    ...invitationData,
    invitationLink,
    acceptLink,
    declineLink,
    expiresAt: formattedExpiresAt,
    companyName,
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
  const companyName = config.COMPANY_BRAND_NAME;
  
  const { subject, html, text } = await renderTemplate("login_notification", {
    displayName,
    companyName,
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
  const companyName = config.COMPANY_BRAND_NAME;
  
  const { subject, html, text } = await renderTemplate("password_reset", {
    displayName,
    token,
    resetPageUrl,
    email: to,
    companyName,
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
  const companyName = config.COMPANY_BRAND_NAME;
  const { subject, html, text } = await renderTemplate("contact_form", {
    ...data,
    submittedAt: data.sentAt,
    companyName,
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
  const companyName = config.COMPANY_BRAND_NAME;
  
  const { subject, html, text } = await renderTemplate("account_notification", {
    displayName,
    category,
    title,
    message,
    eventType,
    occurredAt: occurredAt || new Date().toISOString(),
    companyName,
  });

  await sendEmail({ to, subject, html, text });
}

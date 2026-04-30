import { vi } from "vitest";

export function createMockEmailService() {
  const sentEmails: Array<{
    to: string;
    subject: string;
    body: string;
    timestamp: string;
  }> = [];

  const mockSendEmail = vi.fn(async (options: {
    to: string | string[];
    subject?: string;
    text?: string;
    html?: string;
  }) => {
    const to = Array.isArray(options.to) ? options.to.join(", ") : options.to;
    sentEmails.push({
      to,
      subject: options.subject || "",
      body: options.html || options.text || "",
      timestamp: new Date().toISOString(),
    });
  });

  const mockSendTemplate = vi.fn(async (template: string, to: string, ctx: Record<string, unknown>) => {
    sentEmails.push({
      to,
      subject: `Template: ${template}`,
      body: JSON.stringify(ctx),
      timestamp: new Date().toISOString(),
    });
  });

  vi.mock("../../services/emailService.js", () => ({
    sendEmail: mockSendEmail,
    sendTemplate: mockSendTemplate,
    __sentEmails: sentEmails,
  }));

  return {
    get sentEmails() {
      return sentEmails;
    },
    mockSendEmail,
    mockSendTemplate,
    clearEmails() {
      sentEmails.length = 0;
    },
  };
}

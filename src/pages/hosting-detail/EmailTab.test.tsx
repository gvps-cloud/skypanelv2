import "@testing-library/jest-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EmailTab from "./EmailTab";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiClient: apiMocks,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const domains = [{ id: "domain-123", domain: "thunderm16.live", is_primary: true }];

const emails = [
  {
    address: "test@thunderm16.live",
    mailboxName: "Test User",
    aliases: [],
    status: "active",
    hasMailbox: true,
    quota: 2048,
    quotaUsage: 128,
    forwardersCount: 0,
    isCatchAll: false,
    createdAt: null,
  },
];

const normalizedClientConfig = {
  imapServer: "imap.thunderm16.live",
  imapPort: 993,
  imapSSL: true,
  smtpServer: "smtp.thunderm16.live",
  smtpPort: 465,
  smtpSSL: true,
  pop3Server: "pop3.thunderm16.live",
  pop3Port: 995,
  pop3SSL: true,
};

function setupApiMocks(clientConfig: Record<string, unknown> = normalizedClientConfig) {
  apiMocks.get.mockImplementation(async (path: string) => {
    if (path.endsWith("/emails/test%40thunderm16.live/client-conf")) {
      return clientConfig;
    }
    if (path.endsWith("/emails")) return { emails };
    if (path.endsWith("/domains")) return { domains };
    throw new Error(`Unhandled GET ${path}`);
  });
  apiMocks.post.mockResolvedValue({ success: true });
  apiMocks.patch.mockResolvedValue({ success: true });
  apiMocks.delete.mockResolvedValue({ success: true });
}

describe("EmailTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupApiMocks();
  });

  it("creates a mailbox with split username/domain, catch-all, and integer quota", async () => {
    const user = userEvent.setup();
    render(<EmailTab subscriptionId="sub-123" />);

    await screen.findByText("test@thunderm16.live");
    await user.click(screen.getByRole("button", { name: /add account/i }));
    await user.type(screen.getByLabelText("Email address"), "example");
    await user.click(screen.getByLabelText(/catch-all/i));
    await user.clear(screen.getByLabelText("Mailbox size (MB)"));
    await user.type(screen.getByLabelText("Mailbox size (MB)"), "0");
    await user.type(screen.getByLabelText("Full name"), "Example User");
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^add account$/i }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/hosting/email/sub-123/emails", {
        username: "example",
        domainId: "domain-123",
        isCatchAll: true,
        mailboxName: "Example User",
        mailboxPassword: "Password123!",
        quota: 0,
      });
    });
  });

  it("creates a forwarder-only account without mailbox fields", async () => {
    const user = userEvent.setup();
    render(<EmailTab subscriptionId="sub-123" />);

    await screen.findByText("test@thunderm16.live");
    await user.click(screen.getByRole("button", { name: /add account/i }));
    await user.type(screen.getByLabelText("Email address"), "sales");
    await user.click(screen.getByRole("button", { name: /forwarder-only/i }));
    await user.type(screen.getByLabelText("Forwarding addresses"), "one@example.com\ntwo@example.com");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^add account$/i }));

    await waitFor(() => {
      expect(apiMocks.post).toHaveBeenCalledWith("/hosting/email/sub-123/emails", {
        username: "sales",
        domainId: "domain-123",
        isCatchAll: false,
        forwarders: ["one@example.com", "two@example.com"],
      });
    });
  });

  it("updates mailbox password with Enhance mailboxPassword and preserves zero quota", async () => {
    const user = userEvent.setup();
    render(<EmailTab subscriptionId="sub-123" />);

    await screen.findByText("test@thunderm16.live");
    await user.click(screen.getByTitle("Edit mailbox"));
    await user.type(screen.getByLabelText("New Password"), "NewPassword123!");
    await user.clear(screen.getByLabelText("Quota (MB)"));
    await user.type(screen.getByLabelText("Quota (MB)"), "0");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(apiMocks.patch).toHaveBeenCalledWith("/hosting/email/sub-123/emails/test%40thunderm16.live", {
        mailboxPassword: "NewPassword123!",
        quota: 0,
      });
    });
  });

  it("renders normalized client configuration sections", async () => {
    const user = userEvent.setup();
    render(<EmailTab subscriptionId="sub-123" />);

    await screen.findByText("test@thunderm16.live");
    await user.click(screen.getByTitle("Email client setup"));

    expect(await screen.findByText("IMAP Incoming")).toBeInTheDocument();
    expect(screen.getByText("SMTP Outgoing")).toBeInTheDocument();
    expect(screen.getByText("POP3 Incoming")).toBeInTheDocument();
    expect(screen.getByText("imap.thunderm16.live")).toBeInTheDocument();
    expect(screen.getByText("smtp.thunderm16.live")).toBeInTheDocument();
    expect(screen.getByText("pop3.thunderm16.live")).toBeInTheDocument();
    expect(screen.getAllByText("Required")).toHaveLength(3);
  });

  it("renders Enhance email server domains with standard client defaults", async () => {
    setupApiMocks({ emailServerDomains: ["mail.thunderm16.live"] });
    const user = userEvent.setup();
    render(<EmailTab subscriptionId="sub-123" />);

    await screen.findByText("test@thunderm16.live");
    await user.click(screen.getByTitle("Email client setup"));

    await waitFor(() => {
      expect(screen.getAllByText("mail.thunderm16.live")).toHaveLength(3);
    });
    expect(screen.getByText("993")).toBeInTheDocument();
    expect(screen.getByText("465")).toBeInTheDocument();
    expect(screen.getByText("995")).toBeInTheDocument();
    expect(screen.getAllByText("Required")).toHaveLength(3);
  });

  it("disables account creation when no eligible customer domains exist", async () => {
    apiMocks.get.mockImplementation(async (path: string) => {
      if (path.endsWith("/emails")) return { emails: [] };
      if (path.endsWith("/domains")) {
        return {
          domains: [],
          note: "Email creation can only use customer-owned domains mapped to this website in Enhance.",
        };
      }
      throw new Error(`Unhandled GET ${path}`);
    });

    render(<EmailTab subscriptionId="sub-123" />);

    expect(await screen.findByText(/customer-owned domains/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add account/i })).toBeDisabled();
    expect(screen.getByText(/map a real customer domain/i)).toBeInTheDocument();
  });
});

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WebTab from "./WebTab";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiClient: apiMocks,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

vi.mock("./web-tab/WebsiteStatusCard", () => ({ default: () => <div>website-status</div> }));
vi.mock("./web-tab/MetricsCard", () => ({ default: () => <div>metrics</div> }));
vi.mock("./web-tab/PhpSettingsCard", () => ({ default: () => <div>php-settings</div> }));
vi.mock("./web-tab/PhpExtensionsCard", () => ({ default: () => <div>php-extensions</div> }));
vi.mock("./web-tab/PhpErrorLogCard", () => ({ default: () => <div>php-error-log</div> }));
vi.mock("./web-tab/PhpIniEditorCard", () => ({ default: () => <div>php-ini</div> }));
vi.mock("./web-tab/IoncubeRedisCard", () => ({ default: () => <div>ioncube-redis</div> }));
vi.mock("./web-tab/NginxCacheCard", () => ({ default: () => <div>nginx-fastcgi</div> }));
vi.mock("./web-tab/RedisCard", () => ({ default: () => <div>redis-card</div> }));
vi.mock("./web-tab/RewritesCard", () => ({ default: ({ mode }: { mode: string }) => <div>rewrites-{mode}</div> }));
vi.mock("./web-tab/HtaccessIpRulesCard", () => ({ default: () => <div>htaccess-ip-rules</div> }));
vi.mock("./web-tab/LsphpSettingsCard", () => ({ default: () => <div>lsphp-settings</div> }));
vi.mock("./web-tab/ModSecurityCard", () => ({ default: () => <div>modsecurity</div> }));
vi.mock("./web-tab/VhostEditorCard", () => ({ default: ({ webserver }: { webserver: string }) => <div>vhost-{webserver}</div> }));

function mockWebserverKind(kind: string) {
  apiMocks.get.mockImplementation(async (path: string) => {
    if (path === "/hosting/dns/sub-123/domains") {
      return { domains: [{ id: "domain-123", domain: "example.test" }] };
    }
    if (path === "/hosting/web/sub-123/webserver-kind") {
      return { kind };
    }
    throw new Error(`Unhandled GET ${path}`);
  });
}

describe("WebTab webserver tool selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Nginx tools only when Enhance detects nginx", async () => {
    mockWebserverKind("nginx");

    render(<WebTab subscriptionId="sub-123" />);

    await waitFor(() => expect(screen.getByText("Nginx")).toBeInTheDocument());
    expect(screen.getByText("rewrites-webserver")).toBeInTheDocument();
    expect(screen.getByText("nginx-fastcgi")).toBeInTheDocument();
    expect(screen.getByText("modsecurity")).toBeInTheDocument();
    expect(screen.getByText("vhost-nginx")).toBeInTheDocument();
    expect(screen.queryByText("htaccess-ip-rules")).not.toBeInTheDocument();
    expect(screen.queryByText("lsphp-settings")).not.toBeInTheDocument();
  });

  it("shows Apache tools only when Enhance detects apache", async () => {
    mockWebserverKind("apache");

    render(<WebTab subscriptionId="sub-123" />);

    await waitFor(() => expect(screen.getByText("Apache")).toBeInTheDocument());
    expect(screen.getByText("rewrites-htaccess")).toBeInTheDocument();
    expect(screen.getByText("htaccess-ip-rules")).toBeInTheDocument();
    expect(screen.getByText("modsecurity")).toBeInTheDocument();
    expect(screen.getByText("vhost-apache")).toBeInTheDocument();
    expect(screen.queryByText("nginx-fastcgi")).not.toBeInTheDocument();
    expect(screen.queryByText("lsphp-settings")).not.toBeInTheDocument();
  });

  it("shows LiteSpeed tools only when Enhance detects OpenLiteSpeed", async () => {
    mockWebserverKind("openLiteSpeed");

    render(<WebTab subscriptionId="sub-123" />);

    await waitFor(() => expect(screen.getByText("OpenLiteSpeed")).toBeInTheDocument());
    expect(screen.getByText("rewrites-htaccess")).toBeInTheDocument();
    expect(screen.getByText("htaccess-ip-rules")).toBeInTheDocument();
    expect(screen.getByText("modsecurity")).toBeInTheDocument();
    expect(screen.getByText("lsphp-settings")).toBeInTheDocument();
    expect(screen.queryByText("nginx-fastcgi")).not.toBeInTheDocument();
    expect(screen.queryByText(/vhost-/)).not.toBeInTheDocument();
  });

  it("does not show server-specific tools for unknown webserver kinds", async () => {
    mockWebserverKind("something-new");

    render(<WebTab subscriptionId="sub-123" />);

    await waitFor(() => expect(screen.getByText("Unknown web server")).toBeInTheDocument());
    expect(screen.queryByText("rewrites-webserver")).not.toBeInTheDocument();
    expect(screen.queryByText("rewrites-htaccess")).not.toBeInTheDocument();
    expect(screen.queryByText("nginx-fastcgi")).not.toBeInTheDocument();
    expect(screen.queryByText("htaccess-ip-rules")).not.toBeInTheDocument();
    expect(screen.queryByText("lsphp-settings")).not.toBeInTheDocument();
    expect(screen.queryByText("modsecurity")).not.toBeInTheDocument();
  });
});

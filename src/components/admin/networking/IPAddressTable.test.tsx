import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IPAddressTable } from "./IPAddressTable";

const listIPsMock = vi.fn();
const deleteIPAddressMock = vi.fn();
const updateReverseDNSMock = vi.fn();
const getIPv6RangeRdnsRecordsMock = vi.fn();
const updateIPv6RangeRdnsMock = vi.fn();

vi.mock("@/services/ipamService", () => ({
  listIPs: (...args: any[]) => listIPsMock(...args),
  deleteIPAddress: (...args: any[]) => deleteIPAddressMock(...args),
  updateReverseDNS: (...args: any[]) => updateReverseDNSMock(...args),
  getIPv6RangeRdnsRecords: (...args: any[]) => getIPv6RangeRdnsRecordsMock(...args),
  updateIPv6RangeRdns: (...args: any[]) => updateIPv6RangeRdnsMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./AllocateIPDialog", () => ({
  AllocateIPDialog: () => null,
}));

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <IPAddressTable />
    </QueryClientProvider>,
  );
}

describe("IPAddressTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteIPAddressMock.mockResolvedValue({ success: true });
    updateReverseDNSMock.mockResolvedValue({ success: true });
    getIPv6RangeRdnsRecordsMock.mockResolvedValue({
      success: true,
      data: { records: [], vpsInstances: [{ id: "vps-1", label: "demo-vps", provider_instance_id: "95646725" }] },
    });
    updateIPv6RangeRdnsMock.mockResolvedValue({ success: true, rdns: "mail.example.com" });
  });

  it("renders prefix selector for IPv6 rows with prefix context", async () => {
    listIPsMock.mockResolvedValue({
      success: true,
      data: [
        {
          address: "2600:3c04::10",
          prefix: 64,
          type: "ipv6",
          public: true,
          rdns: "host.example.com",
          instanceId: "95646725",
          region: "ca-central",
          ipv6Prefixes: [
            { range: "2600:3c04:e001:364::", prefixLength: 64, region: "ca-central", routeTarget: "2600:3c04::1" },
            { range: "2600:3c04:e001:365::", prefixLength: 64, region: "ca-central", routeTarget: "2600:3c04::1" },
          ],
        },
      ],
      pages: 1,
      total: 1,
    });

    renderComponent();

    await screen.findByText("2600:3c04::10");
    await screen.findByText("IPv6 prefix");
    expect(getIPv6RangeRdnsRecordsMock).toHaveBeenCalledWith("2600:3c04:e001:364::", 64);
  });

  it("routes saves through range-rDNS for IPv6 prefix rows and direct rDNS for standalone rows", async () => {
    listIPsMock.mockResolvedValue({
      success: true,
      data: [
        {
          address: "2600:3c04::10",
          prefix: 64,
          type: "ipv6",
          public: true,
          rdns: null,
          instanceId: "95646725",
          region: "ca-central",
          ipv6Prefixes: [
            { range: "2600:3c04:e001:364::", prefixLength: 64, region: "ca-central", routeTarget: "2600:3c04::1" },
          ],
        },
        {
          address: "139.177.199.181",
          prefix: 24,
          type: "ipv4",
          public: true,
          rdns: null,
          instanceId: "95646725",
          region: "ca-central",
        },
      ],
      pages: 1,
      total: 2,
    });

    renderComponent();

    await screen.findByText("2600:3c04::10");

    const domainInput = await screen.findByLabelText("Domain name") as HTMLInputElement;
    fireEvent.change(domainInput, { target: { value: "mail.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateIPv6RangeRdnsMock).toHaveBeenCalled();
    });
    expect(updateIPv6RangeRdnsMock).toHaveBeenLastCalledWith(
      "2600:3c04:e001:364::",
      64,
      "2600:3c04:e001:364::1",
      "mail.example.com",
    );

    fireEvent.click(screen.getByText("139.177.199.181"));

    const directInput = await screen.findByLabelText("Reverse DNS hostname");
    fireEvent.change(directInput, { target: { value: "host4.example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Save rDNS" }));

    await waitFor(() => {
      expect(updateReverseDNSMock).toHaveBeenCalledWith("139.177.199.181", "host4.example.com");
    });
  });

  it("resets direct rDNS state when switching selected rows", async () => {
    listIPsMock.mockResolvedValue({
      success: true,
      data: [
        {
          address: "139.177.199.181",
          prefix: 24,
          type: "ipv4",
          public: true,
          rdns: "one.example.com",
          instanceId: "95646725",
          region: "ca-central",
        },
        {
          address: "139.177.199.182",
          prefix: 24,
          type: "ipv4",
          public: true,
          rdns: "two.example.com",
          instanceId: "95646725",
          region: "ca-central",
        },
      ],
      pages: 1,
      total: 2,
    });

    renderComponent();

    await screen.findByText("139.177.199.181");

    const rdnsInput = await screen.findByLabelText("Reverse DNS hostname") as HTMLInputElement;
    expect(rdnsInput.value).toBe("one.example.com");

    fireEvent.change(rdnsInput, { target: { value: "edited-value.example.com" } });
    expect((screen.getByLabelText("Reverse DNS hostname") as HTMLInputElement).value).toBe("edited-value.example.com");

    fireEvent.click(screen.getByText("139.177.199.182"));

    await waitFor(() => {
      expect((screen.getByLabelText("Reverse DNS hostname") as HTMLInputElement).value).toBe("two.example.com");
    });
  });
});

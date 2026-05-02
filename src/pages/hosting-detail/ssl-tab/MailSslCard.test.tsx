import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import MailSslCard from "./MailSslCard";

beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

const postMock = vi.fn();

vi.mock("@/lib/api", () => ({
  apiClient: { post: (...args: unknown[]) => postMock(...args) },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("MailSslCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    postMock.mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lists mail hostnames for every mapped domain passed in", async () => {
    const user = userEvent.setup();
    render(
      <MailSslCard
        subscriptionId="sub-1"
        domains={[
          { id: "dom-primary", domain: "customer.example", is_primary: true },
          { id: "dom-staging", domain: "app.staging.cp.gvps.cloud" },
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    expect(
      screen.getByRole("option", { name: /mail\.customer\.example \(Primary\)/, hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /^mail\.app\.staging\.cp\.gvps\.cloud$/, hidden: true }),
    ).toBeInTheDocument();
  });

  it("posts mail-ssl for the selected mapping id", async () => {
    const user = userEvent.setup();
    render(
      <MailSslCard
        subscriptionId="sub-1"
        domains={[
          { id: "dom-primary", domain: "customer.example", is_primary: true },
          { id: "dom-staging", domain: "app.staging.cp.gvps.cloud" },
        ]}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(
      screen.getByRole("option", { name: /^mail\.app\.staging\.cp\.gvps\.cloud$/, hidden: true }),
    );
    await user.click(screen.getByRole("button", { name: /issue mail ssl/i }));

    expect(postMock).toHaveBeenCalledWith("/hosting/web/sub-1/domains/dom-staging/mail-ssl");
  });
});

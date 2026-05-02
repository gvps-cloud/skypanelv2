import { describe, expect, it } from "vitest";
import { mergeDomainsForMailSsl } from "./mergeMailSslDomainLists";

describe("mergeDomainsForMailSsl", () => {
  it("includes mappings only present in the non-withSsl listing", () => {
    const ssl = [{ id: "p1", domain: "primary.example", sslActive: true, forceSsl: true, is_primary: true }];
    const all = [
      ...ssl,
      { id: "s1", domain: "site.staging.cp.example.com", is_primary: false },
    ];
    const merged = mergeDomainsForMailSsl(ssl, all);
    expect(merged.map((d) => d.id).sort()).toEqual(["p1", "s1"].sort());
    expect(merged.find((d) => d.id === "s1")).toMatchObject({
      domain: "site.staging.cp.example.com",
      sslActive: false,
      forceSsl: false,
    });
  });

  it("preserves ssl flags from the withSsl response", () => {
    const ssl = [{ id: "d1", domain: "a.example", sslActive: true, forceSsl: false }];
    const all = [{ id: "d1", domain: "a.example", is_primary: true }];
    expect(mergeDomainsForMailSsl(ssl, all)[0]).toMatchObject({
      sslActive: true,
      forceSsl: false,
      is_primary: true,
    });
  });

  it("sorts primary first then alphabetically", () => {
    const all = [
      { id: "b", domain: "bbb.example", is_primary: false },
      { id: "a", domain: "aaa.example", is_primary: true },
    ];
    expect(mergeDomainsForMailSsl([], all).map((d) => d.id)).toEqual(["a", "b"]);
  });
});

import { describe, expect, it, vi } from "vitest";
import { fetchPublicTextExcerpt } from "@/lib/security/public-document";

describe("public evidence document fetch", () => {
  it("does not read a host that resolves to a private address", async () => {
    const fetchImpl = vi.fn();
    const excerpt = await fetchPublicTextExcerpt({
      url: "https://contoh.example/berita",
      timeoutMs: 1000,
      fetchImpl,
      lookupImpl: async () => [{ address: "127.0.0.1" }],
    });
    expect(excerpt).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reads a short public html excerpt and stops at a private redirect", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<html><body><p>Korlantas menyatakan masa berlaku SIM tetap lima tahun sesuai undang-undang lalu lintas.</p></body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      )
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { Location: "http://169.254.169.254/latest/meta-data" },
        })
      );
    const excerpt = await fetchPublicTextExcerpt({
      url: "https://korlantas.polri.go.id/sim",
      timeoutMs: 1000,
      fetchImpl,
      lookupImpl: async () => [{ address: "103.0.0.10" }],
    });
    expect(excerpt).toContain("masa berlaku SIM tetap lima tahun");

    const redirected = await fetchPublicTextExcerpt({
      url: "https://cekfakta.com/arsip",
      timeoutMs: 1000,
      fetchImpl,
      lookupImpl: async () => [{ address: "103.0.0.10" }],
    });
    expect(redirected).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

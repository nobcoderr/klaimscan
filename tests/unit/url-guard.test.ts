import { describe, expect, it } from "vitest";
import {
  isPrivateOrInternalHostname,
  sanitizePublicEvidenceUrl,
} from "@/lib/security/url-guard";

describe("url-guard SSRF & URL safety", () => {
  it("blocks localhost, private IPv4, metadata endpoints, and IPv6 local addresses", () => {
    const unsafeUrls = [
      "http://localhost:3000/admin",
      "http://127.0.0.1/secret",
      "http://10.0.0.5/internal",
      "http://172.16.4.2/api",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]:8080/",
      "http://[fe80::1]/",
      "http://internal-service/health",
      "http://metadata.internal/compute",
      "https://user:pass@komdigi.go.id/",
      "javascript:alert(1)",
      "file:///C:/Windows/System32/drivers/etc/hosts",
    ];

    for (const url of unsafeUrls) {
      expect(sanitizePublicEvidenceUrl(url)).toBeNull();
    }

    expect(isPrivateOrInternalHostname("169.254.169.254")).toBe(true);
    expect(isPrivateOrInternalHostname("korlantas.polri.go.id")).toBe(false);
  });

  it("permits valid public HTTPS/HTTP URLs and strips tracking query params", () => {
    expect(
      sanitizePublicEvidenceUrl(
        "https://korlantas.polri.go.id/berita?utm_source=x&fbclid=123&id=45"
      )
    ).toBe("https://korlantas.polri.go.id/berita?id=45");
  });
});

import { describe, expect, it } from "vitest";
import { POST as analyzePost } from "@/app/api/analyze/route";
import { GET as healthGet } from "@/app/api/health/route";

describe("API routes", () => {
  it("GET /api/health returns online status without exposing secret keys", async () => {
    const response = await healthGet();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      config: Record<string, unknown>;
    };
    expect(body.status).toBe("online");
    expect(body.config).toHaveProperty("openAiConfigured");
    expect(body.config).toHaveProperty("factCheckConfigured");
    expect(JSON.stringify(body)).not.toContain("AIzaSy");
    expect(JSON.stringify(body)).not.toContain("sk-");
  });

  it("POST /api/analyze rejects missing file with 400", async () => {
    const formData = new FormData();
    const req = new Request("http://localhost/api/analyze", {
      method: "POST",
      body: formData,
    });

    const response = await analyzePost(req);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("MISSING_FILE");
  });

  it("POST /api/analyze rejects invalid non-image file with 400", async () => {
    const formData = new FormData();
    const fakeBlob = new Blob(["not an image".repeat(20)], {
      type: "image/png",
    });
    formData.append("file", fakeBlob, "fake.png");

    const req = new Request("http://localhost/api/analyze", {
      method: "POST",
      body: formData,
    });

    const response = await analyzePost(req);
    expect(response.status).toBe(400);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe("INVALID_IMAGE");
  });
});

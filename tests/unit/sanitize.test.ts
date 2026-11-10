import { describe, expect, it } from "vitest";
import {
  detectImageMimeFromMagicBytes,
  ImageValidationError,
  sanitizeScreenshotBuffer,
} from "@/lib/image/sanitize";
import {
  makeMinimalJpegWithExif,
  makeMinimalPngWithTextChunk,
  makeMinimalWebpWithExif,
  makeOversizedPngBuffer,
} from "../fixtures/images";

describe("sanitizeScreenshotBuffer", () => {
  it("rejects non-image buffers disguised with .png filename", () => {
    const fake = Buffer.from("<html>not an image</html>".repeat(12), "utf8");
    expect(() => sanitizeScreenshotBuffer(fake, "fake.png", "image/png")).toThrow(
      ImageValidationError
    );
  });

  it("rejects images larger than 5MB", () => {
    const oversized = makeOversizedPngBuffer();

    expect(() =>
      sanitizeScreenshotBuffer(oversized, "oversized.png", "image/png")
    ).toThrow(/5 MB/);
  });

  it("strips PNG tEXt and eXIf chunks while preserving IHDR/IDAT/IEND", () => {
    const raw = makeMinimalPngWithTextChunk();
    expect(detectImageMimeFromMagicBytes(raw)).toBe("image/png");

    const res = sanitizeScreenshotBuffer(raw, "shot.png", "image/png");
    expect(res.mimeType).toBe("image/png");
    expect(res.summary.persistedOnServer).toBe(false);
    expect(res.summary.strippedSegments).toContain("PNG tEXt");
    expect(res.summary.strippedSegments).toContain("PNG eXIf");
    expect(res.summary.metadataRemovedBytes).toBeGreaterThan(0);
    expect(res.buffer.includes(Buffer.from("SecretCameraDevice123"))).toBe(
      false
    );
    expect(res.buffer.includes(Buffer.from("IDAT"))).toBe(true);
  });

  it("strips JPEG APP1 EXIF segment cleanly", () => {
    const raw = makeMinimalJpegWithExif();
    const res = sanitizeScreenshotBuffer(raw, "photo.jpg", "image/jpeg");

    expect(res.mimeType).toBe("image/jpeg");
    expect(res.summary.strippedSegments).toContain("JPEG APP1 (EXIF/XMP)");
    expect(res.buffer.includes(Buffer.from("SECRET_GPS_01"))).toBe(false);
  });

  it("strips WebP EXIF chunk and clears VP8X EXIF flag", () => {
    const raw = makeMinimalWebpWithExif();
    const res = sanitizeScreenshotBuffer(raw, "post.webp", "image/webp");

    expect(res.mimeType).toBe("image/webp");
    expect(res.summary.strippedSegments).toContain("WebP EXIF");
    expect(res.buffer.includes(Buffer.from("PRIVATE_EXIF_DATA"))).toBe(false);
    expect(res.buffer[20] & 0x08).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import {
  createServerOcrRulerGuide,
  OcrGuideIntegrityError,
} from "@/lib/image/ocr-guide";
import {
  detectImageMimeFromMagicBytes,
  ImageValidationError,
  MAX_IMAGE_BYTES,
  sanitizeScreenshotBuffer,
} from "@/lib/image/sanitize";
import {
  makeMinimalJpegWithExif,
  makeMinimalPngWithTextChunk,
  makeMinimalWebpWithExif,
  makeOversizedPngBuffer,
  makeRealRasterPngBuffer,
} from "../fixtures/images";

describe("sanitizeScreenshotBuffer & server OCR guide integrity", () => {
  it("rejects non-image buffers disguised with .png filename", () => {
    const fake = Buffer.from("<html>not an image</html>".repeat(12), "utf8");
    expect(() => sanitizeScreenshotBuffer(fake, "fake.png", "image/png")).toThrow(
      ImageValidationError
    );
  });

  it("rejects images larger than 4MB with clear platform-limit explanation", () => {
    const oversized = makeOversizedPngBuffer();

    expect(() =>
      sanitizeScreenshotBuffer(oversized, "oversized.png", "image/png")
    ).toThrow(/4 MB/);
  });

  it("generates server-side OCR ruler guide tied to sanitized SHA-256 and rejects mismatched hashes", async () => {
    const portrait = await makeRealRasterPngBuffer(540, 1170);
    const sanitized = sanitizeScreenshotBuffer(
      portrait,
      "portrait.png",
      "image/png"
    );

    const guide = await createServerOcrRulerGuide({
      sanitizedImageBuffer: sanitized.buffer,
      mimeType: sanitized.mimeType,
      expectedSha256: sanitized.summary.sha256,
    });

    expect(guide.hasCoordinateRulers).toBe(true);
    expect(guide.sourceSha256).toBe(sanitized.summary.sha256);
    expect(guide.width).toBeGreaterThan(400);
    expect(guide.height).toBeGreaterThan(guide.width);

    await expect(
      createServerOcrRulerGuide({
        sanitizedImageBuffer: sanitized.buffer,
        mimeType: sanitized.mimeType,
        expectedSha256: "f".repeat(64),
      })
    ).rejects.toBeInstanceOf(OcrGuideIntegrityError);
  });

  it("handles large valid portrait and landscape files cleanly under the 4.5MB Vercel limit", async () => {
    const largePortrait = await makeRealRasterPngBuffer(880, 1280, {
      noisy: true,
    });
    const largeLandscape = await makeRealRasterPngBuffer(1280, 880, {
      noisy: true,
    });

    expect(largePortrait.length).toBeGreaterThan(2_000_000);
    expect(largePortrait.length).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
    expect(largeLandscape.length).toBeGreaterThan(2_000_000);
    expect(largeLandscape.length).toBeLessThanOrEqual(MAX_IMAGE_BYTES);

    const resPortrait = sanitizeScreenshotBuffer(
      largePortrait,
      "large-portrait.png",
      "image/png"
    );
    const resLandscape = sanitizeScreenshotBuffer(
      largeLandscape,
      "large-landscape.png",
      "image/png"
    );

    expect(resPortrait.summary.persistedOnServer).toBe(false);
    expect(resLandscape.summary.persistedOnServer).toBe(false);

    const portraitGuide = await createServerOcrRulerGuide({
      sanitizedImageBuffer: resPortrait.buffer,
      mimeType: resPortrait.mimeType,
      expectedSha256: resPortrait.summary.sha256,
    });
    const landscapeGuide = await createServerOcrRulerGuide({
      sanitizedImageBuffer: resLandscape.buffer,
      mimeType: resLandscape.mimeType,
      expectedSha256: resLandscape.summary.sha256,
    });

    expect(portraitGuide.hasCoordinateRulers).toBe(true);
    expect(landscapeGuide.hasCoordinateRulers).toBe(true);
    expect(portraitGuide.height).toBeGreaterThan(portraitGuide.width);
    expect(landscapeGuide.width).toBeGreaterThan(landscapeGuide.height);
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

import { describe, expect, it } from "vitest";
import {
  detectImageMimeFromMagicBytes,
  ImageValidationError,
  MAX_IMAGE_BYTES,
  sanitizeScreenshotBuffer,
} from "@/lib/image/sanitize";

function makeMinimalPngWithTextChunk(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const makeChunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const ihdr = makeChunk("IHDR", Buffer.alloc(13, 1));
  const textChunk = makeChunk(
    "tEXt",
    Buffer.from("Author\0SecretCameraDevice123", "utf8")
  );
  const exifChunk = makeChunk(
    "eXIf",
    Buffer.from("MM\0*EXIF_GPS_DATA", "utf8")
  );
  const idat = makeChunk("IDAT", Buffer.alloc(140, 0xaa));
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, textChunk, exifChunk, idat, iend]);
}

function makeMinimalJpegWithExif(): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const app1Payload = Buffer.from("Exif\0\0SECRET_GPS_01", "ascii");
  const app1Header = Buffer.alloc(4);
  app1Header[0] = 0xff;
  app1Header[1] = 0xe1;
  app1Header.writeUInt16BE(2 + app1Payload.length, 2);
  const app1 = Buffer.concat([app1Header, app1Payload]);

  const sosHeader = Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0]);
  const scanBody = Buffer.alloc(140, 0x11);
  const eoi = Buffer.from([0xff, 0xd9]);

  return Buffer.concat([soi, app1, sosHeader, scanBody, eoi]);
}

function makeMinimalWebpWithExif(): Buffer {
  const makeChunk = (id: string, payload: Buffer) => {
    const hdr = Buffer.alloc(8);
    hdr.write(id, 0, "ascii");
    hdr.writeUInt32LE(payload.length, 4);
    const pad = payload.length % 2 === 1 ? Buffer.from([0]) : Buffer.alloc(0);
    return Buffer.concat([hdr, payload, pad]);
  };

  const vp8xPayload = Buffer.alloc(10, 0);
  vp8xPayload[0] = 0x08;
  const vp8x = makeChunk("VP8X", vp8xPayload);
  const vp8 = makeChunk("VP8 ", Buffer.alloc(120, 0x22));
  const exif = makeChunk("EXIF", Buffer.from("PRIVATE_EXIF_DATA", "ascii"));

  const body = Buffer.concat([vp8x, vp8, exif]);
  const riff = Buffer.alloc(12);
  riff.write("RIFF", 0, "ascii");
  riff.writeUInt32LE(4 + body.length, 4);
  riff.write("WEBP", 8, "ascii");

  return Buffer.concat([riff, body]);
}

describe("sanitizeScreenshotBuffer", () => {
  it("rejects non-image buffers disguised with .png filename", () => {
    const fake = Buffer.from("<html>not an image</html>".repeat(12), "utf8");
    expect(() => sanitizeScreenshotBuffer(fake, "fake.png", "image/png")).toThrow(
      ImageValidationError
    );
  });

  it("rejects images larger than 5MB", () => {
    const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 10, 0);
    oversized[0] = 0x89;
    oversized[1] = 0x50;
    oversized[2] = 0x4e;
    oversized[3] = 0x47;
    oversized[4] = 0x0d;
    oversized[5] = 0x0a;
    oversized[6] = 0x1a;
    oversized[7] = 0x0a;

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

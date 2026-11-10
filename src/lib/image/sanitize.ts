import { createHash } from "node:crypto";
import type { ProcessedImageSummary } from "@/lib/types";

export const ALLOWED_IMAGE_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_IMAGE_BYTES = 128;

export interface SanitizedImageResult {
  buffer: Buffer;
  mimeType: AllowedImageMime;
  base64DataUrl: string;
  summary: ProcessedImageSummary;
}

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

export function detectImageMimeFromMagicBytes(
  buffer: Buffer
): AllowedImageMime | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function stripJpegMetadata(buffer: Buffer): {
  cleanBuffer: Buffer;
  strippedSegments: string[];
} {
  const chunks: Buffer[] = [buffer.subarray(0, 2)]; // SOI FF D8
  const strippedSegments: string[] = [];
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      // Unexpected byte outside marker; preserve remainder safely
      chunks.push(buffer.subarray(offset));
      break;
    }

    // Consume fill 0xFF bytes
    while (offset + 1 < buffer.length && buffer[offset + 1] === 0xff) {
      offset += 1;
    }

    if (offset + 1 >= buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    const marker = buffer[offset + 1];

    // Standalone markers without length
    if (marker === 0xd9) {
      chunks.push(buffer.subarray(offset, offset + 2));
      break;
    }

    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      chunks.push(buffer.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    if (offset + 4 > buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    const totalLength = 2 + segmentLength;

    if (segmentLength < 2 || offset + totalLength > buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    // SOS (Start of Scan): copy remainder of entropy-coded bitstream directly
    if (marker === 0xda) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    // Strip APP1..APP15 (EXIF, XMP, IPTC, ICC) and COM (0xFE)
    const isAppMetadata = marker >= 0xe1 && marker <= 0xef;
    const isComment = marker === 0xfe;

    if (isAppMetadata || isComment) {
      const label = isComment
        ? "JPEG COM"
        : marker === 0xe1
          ? "JPEG APP1 (EXIF/XMP)"
          : `JPEG APP${marker - 0xe0}`;
      strippedSegments.push(label);
      offset += totalLength;
      continue;
    }

    chunks.push(buffer.subarray(offset, offset + totalLength));
    offset += totalLength;
  }

  return {
    cleanBuffer: Buffer.concat(chunks),
    strippedSegments,
  };
}

const PNG_METADATA_CHUNKS = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

function stripPngMetadata(buffer: Buffer): {
  cleanBuffer: Buffer;
  strippedSegments: string[];
} {
  const chunks: Buffer[] = [buffer.subarray(0, 8)];
  const strippedSegments: string[] = [];
  let offset = 8;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const totalLength = 12 + length;

    if (offset + totalLength > buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    if (PNG_METADATA_CHUNKS.has(type)) {
      strippedSegments.push(`PNG ${type}`);
      offset += totalLength;
      continue;
    }

    chunks.push(buffer.subarray(offset, offset + totalLength));
    offset += totalLength;

    if (type === "IEND") {
      break;
    }
  }

  return {
    cleanBuffer: Buffer.concat(chunks),
    strippedSegments,
  };
}

const WEBP_METADATA_CHUNKS = new Set(["EXIF", "XMP "]);

function stripWebpMetadata(buffer: Buffer): {
  cleanBuffer: Buffer;
  strippedSegments: string[];
} {
  const chunks: Buffer[] = [];
  const strippedSegments: string[] = [];
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const paddedSize = chunkSize + (chunkSize % 2);
    const totalLength = 8 + paddedSize;

    if (offset + 8 + chunkSize > buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    if (WEBP_METADATA_CHUNKS.has(chunkId)) {
      strippedSegments.push(`WebP ${chunkId.trim()}`);
      offset += Math.min(totalLength, buffer.length - offset);
      continue;
    }

    const slice = Buffer.from(
      buffer.subarray(offset, Math.min(offset + totalLength, buffer.length))
    );

    // Clear EXIF (bit 3: 0x08) and XMP (bit 2: 0x04) flags in VP8X header
    if (chunkId === "VP8X" && slice.length >= 9) {
      slice[8] = slice[8] & ~0x0c;
    }

    chunks.push(slice);
    offset += totalLength;
  }

  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(4 + body.length, 4);
  header.write("WEBP", 8, "ascii");

  return {
    cleanBuffer: Buffer.concat([header, body]),
    strippedSegments,
  };
}

export function sanitizeScreenshotBuffer(
  rawBuffer: Buffer,
  fileName: string,
  declaredMimeType?: string
): SanitizedImageResult {
  if (rawBuffer.length < MIN_IMAGE_BYTES) {
    throw new ImageValidationError(
      "File gambar terlalu kecil atau rusak. Unggah screenshot JPG, PNG, atau WebP yang valid."
    );
  }

  if (rawBuffer.length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      "Ukuran file melebihi batas 10 MB. Kompres atau potong screenshot terlebih dahulu."
    );
  }

  const detectedMime = detectImageMimeFromMagicBytes(rawBuffer);
  if (!detectedMime) {
    throw new ImageValidationError(
      "Format file tidak didukung. Gunakan screenshot JPG, PNG, atau WebP yang valid."
    );
  }

  if (
    declaredMimeType &&
    declaredMimeType !== "application/octet-stream" &&
    ALLOWED_IMAGE_MIMES.includes(declaredMimeType as AllowedImageMime) &&
    declaredMimeType !== detectedMime
  ) {
    // Allow minor jpeg/jpg aliases, otherwise warn via detected mime
  }

  let strippedResult: { cleanBuffer: Buffer; strippedSegments: string[] };
  if (detectedMime === "image/jpeg") {
    strippedResult = stripJpegMetadata(rawBuffer);
  } else if (detectedMime === "image/png") {
    strippedResult = stripPngMetadata(rawBuffer);
  } else {
    strippedResult = stripWebpMetadata(rawBuffer);
  }

  const { cleanBuffer, strippedSegments } = strippedResult;
  const sha256 = createHash("sha256").update(cleanBuffer).digest("hex");
  const metadataRemovedBytes = Math.max(0, rawBuffer.length - cleanBuffer.length);
  const base64DataUrl = `data:${detectedMime};base64,${cleanBuffer.toString("base64")}`;

  return {
    buffer: cleanBuffer,
    mimeType: detectedMime,
    base64DataUrl,
    summary: {
      fileName: fileName || "screenshot",
      mimeType: detectedMime,
      originalBytes: rawBuffer.length,
      sanitizedBytes: cleanBuffer.length,
      metadataRemovedBytes,
      strippedSegments,
      sha256,
      persistedOnServer: false,
    },
  };
}

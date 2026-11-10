import { createHash } from "node:crypto";
import sharp from "sharp";
import type { AllowedImageMime } from "./sanitize";

export class OcrGuideIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrGuideIntegrityError";
  }
}

export interface ServerOcrGuideResult {
  buffer: Buffer;
  base64DataUrl: string;
  sourceSha256: string;
  width: number;
  height: number;
  hasCoordinateRulers: boolean;
}

// 5x7 crisp bitmap font for digits 0..9 (zero system font dependencies on serverless Linux)
const DIGIT_GLYPHS_5X7: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};

function setPixel(
  canvas: Buffer,
  canvasWidth: number,
  canvasHeight: number,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255
): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= canvasWidth || iy >= canvasHeight) return;
  const idx = (iy * canvasWidth + ix) * 4;
  canvas[idx] = r;
  canvas[idx + 1] = g;
  canvas[idx + 2] = b;
  canvas[idx + 3] = a;
}

function drawLineSegment(
  canvas: Buffer,
  canvasWidth: number,
  canvasHeight: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: number,
  g: number,
  b: number
): void {
  const minX = Math.min(Math.round(x1), Math.round(x2));
  const maxX = Math.max(Math.round(x1), Math.round(x2));
  const minY = Math.min(Math.round(y1), Math.round(y2));
  const maxY = Math.max(Math.round(y1), Math.round(y2));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      setPixel(canvas, canvasWidth, canvasHeight, x, y, r, g, b);
    }
  }
}

function drawNumberText(
  canvas: Buffer,
  canvasWidth: number,
  canvasHeight: number,
  text: string,
  anchorX: number,
  centerY: number,
  align: "right" | "center",
  scale = 2
): void {
  const glyphW = 5 * scale;
  const glyphH = 7 * scale;
  const gap = scale;
  const totalW =
    text.length * glyphW + Math.max(0, text.length - 1) * gap;
  const startX =
    align === "right"
      ? Math.round(anchorX - totalW)
      : Math.round(anchorX - totalW / 2);
  const startY = Math.round(centerY - glyphH / 2);

  for (let charIdx = 0; charIdx < text.length; charIdx += 1) {
    const glyph = DIGIT_GLYPHS_5X7[text[charIdx] ?? ""];
    if (!glyph) continue;
    const ox = startX + charIdx * (glyphW + gap);
    for (let row = 0; row < 7; row += 1) {
      const pattern = glyph[row] ?? "";
      for (let col = 0; col < 5; col += 1) {
        if (pattern[col] !== "1") continue;
        for (let dy = 0; dy < scale; dy += 1) {
          for (let dx = 0; dx < scale; dx += 1) {
            setPixel(
              canvas,
              canvasWidth,
              canvasHeight,
              ox + col * scale + dx,
              startY + row * scale + dy,
              248,
              250,
              252
            );
          }
        }
      }
    }
  }
}

export async function createServerOcrRulerGuide(params: {
  sanitizedImageBuffer: Buffer;
  mimeType: AllowedImageMime;
  expectedSha256?: string;
}): Promise<ServerOcrGuideResult> {
  const { sanitizedImageBuffer, mimeType, expectedSha256 } = params;
  const actualSha256 = createHash("sha256")
    .update(sanitizedImageBuffer)
    .digest("hex");

  if (expectedSha256 && expectedSha256 !== actualSha256) {
    throw new OcrGuideIntegrityError(
      "Ketidakcocokan hash bukti gambar: panduan OCR harus dibuat langsung dari screenshot asli yang tervalidasi."
    );
  }

  try {
    const meta = await sharp(sanitizedImageBuffer, {
      limitInputPixels: 40_000_000,
    }).metadata();
    const natW = meta.width ?? 0;
    const natH = meta.height ?? 0;
    if (natW <= 0 || natH <= 0) {
      throw new Error("Invalid raster dimensions");
    }

    const maxEdge = Math.max(natW, natH);
    const minEdge = Math.min(natW, natH);
    let scale = 1;
    if (minEdge < 460) {
      scale = Math.min(2.4, 460 / minEdge);
    }
    if (maxEdge * scale > 1080) {
      scale = 1080 / maxEdge;
    }

    const iw = Math.max(120, Math.round(natW * scale));
    const ih = Math.max(120, Math.round(natH * scale));
    const padL = 64;
    const padT = 40;
    const padR = 34;
    const padB = 20;
    const canvasWidth = padL + iw + padR;
    const canvasHeight = padT + ih + padB;

    const resized = await sharp(sanitizedImageBuffer, {
      limitInputPixels: 40_000_000,
    })
      .resize(iw, ih, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const canvasBuf = Buffer.alloc(canvasWidth * canvasHeight * 4);
    for (let i = 0; i < canvasBuf.length; i += 4) {
      canvasBuf[i] = 11;
      canvasBuf[i + 1] = 18;
      canvasBuf[i + 2] = 32;
      canvasBuf[i + 3] = 255;
    }

    const srcData = resized.data;
    const srcW = resized.info.width;
    const srcH = resized.info.height;
    for (let y = 0; y < srcH; y += 1) {
      const srcRowStart = y * srcW * 4;
      const dstRowStart = ((padT + y) * canvasWidth + padL) * 4;
      srcData.copy(canvasBuf, dstRowStart, srcRowStart, srcRowStart + srcW * 4);
    }

    // Draw cyan (#38BDF8) 0..1000 coordinate ticks & pure-bitmap scale digits
    const xLabelStep = iw >= 420 ? 100 : iw >= 220 ? 200 : 500;
    for (let t = 0; t <= 1000; t += 50) {
      const yy = Math.round(padT + (t / 1000) * ih);
      const isMajor = t % 100 === 0;
      const tickLen = isMajor ? 10 : 5;
      drawLineSegment(
        canvasBuf,
        canvasWidth,
        canvasHeight,
        padL - tickLen,
        yy,
        padL,
        yy + 1,
        56,
        189,
        248
      );
      drawLineSegment(
        canvasBuf,
        canvasWidth,
        canvasHeight,
        padL + iw,
        yy,
        padL + iw + (isMajor ? 8 : 4),
        yy + 1,
        56,
        189,
        248
      );
      if (isMajor) {
        drawNumberText(
          canvasBuf,
          canvasWidth,
          canvasHeight,
          String(t),
          padL - 13,
          yy,
          "right",
          2
        );
      }
    }

    for (let t = 0; t <= 1000; t += 50) {
      const xx = Math.round(padL + (t / 1000) * iw);
      const isMajor = t % 100 === 0;
      const tickLen = isMajor ? 10 : 5;
      drawLineSegment(
        canvasBuf,
        canvasWidth,
        canvasHeight,
        xx,
        padT - tickLen,
        xx + 1,
        padT,
        56,
        189,
        248
      );
      drawLineSegment(
        canvasBuf,
        canvasWidth,
        canvasHeight,
        xx,
        padT + ih,
        xx + 1,
        padT + ih + (isMajor ? 7 : 4),
        56,
        189,
        248
      );
      if (t % xLabelStep === 0) {
        drawNumberText(
          canvasBuf,
          canvasWidth,
          canvasHeight,
          String(t),
          xx,
          padT - 20,
          "center",
          2
        );
      }
    }

    const outPng = await sharp(canvasBuf, {
      raw: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
      },
    })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return {
      buffer: outPng,
      base64DataUrl: `data:image/png;base64,${outPng.toString("base64")}`,
      sourceSha256: actualSha256,
      width: canvasWidth,
      height: canvasHeight,
      hasCoordinateRulers: true,
    };
  } catch (error) {
    if (error instanceof OcrGuideIntegrityError) {
      throw error;
    }
    return {
      buffer: sanitizedImageBuffer,
      base64DataUrl: `data:${mimeType};base64,${sanitizedImageBuffer.toString("base64")}`,
      sourceSha256: actualSha256,
      width: 0,
      height: 0,
      hasCoordinateRulers: false,
    };
  }
}

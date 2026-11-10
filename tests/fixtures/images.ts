import { MAX_IMAGE_BYTES } from "@/lib/image/sanitize";

export function makeMinimalPngBuffer(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const makeChunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    return Buffer.concat([len, typeBuf, data, crc]);
  };

  const ihdr = makeChunk("IHDR", Buffer.alloc(13, 1));
  const idat = makeChunk("IDAT", Buffer.alloc(140, 0xaa));
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

export function makeMinimalPngWithTextChunk(): Buffer {
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

export function makeMinimalJpegWithExif(): Buffer {
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

export function makeMinimalWebpWithExif(): Buffer {
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

export function makeOversizedPngBuffer(): Buffer {
  const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 10, 0);
  oversized[0] = 0x89;
  oversized[1] = 0x50;
  oversized[2] = 0x4e;
  oversized[3] = 0x47;
  oversized[4] = 0x0d;
  oversized[5] = 0x0a;
  oversized[6] = 0x1a;
  oversized[7] = 0x0a;
  return oversized;
}

import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Service boundary interface for retrieving and saving application icons.
 * Anti-Corruption Layer (SRP): Isolates network I/O, format conversion, and disk writing.
 */
export interface AppIconService {
  /**
   * Resolves the favicon for a target URL and writes it as an .ico file at targetPath.
   * Resolves to the saved path on success, or null if resolution/fetch fails.
   */
  resolveIcon(url: string, targetPath: string): Promise<string | null>;
}

/**
 * Checks if a buffer starts with standard Windows ICO header magic bytes (0x00, 0x00, 0x01, 0x00).
 */
export function isIcoBuffer(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer[0] === 0x00 && buffer[1] === 0x00 && buffer[2] === 0x01 && buffer[3] === 0x00;
}

/**
 * Checks if a buffer starts with PNG magic bytes (\x89PNG).
 */
export function isPngBuffer(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  return (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

/**
 * Wraps a PNG image buffer into a single-image Windows .ico container without transcoding.
 * Windows Vista+ natively supports embedded PNG images inside .ico files.
 */
export function wrapPngInIco(pngBuffer: Buffer): Buffer {
  // ICONDIR header (6 bytes): reserved (2) + type 1 (2) + count 1 (2)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // 1 = ICO format
  header.writeUInt16LE(1, 4); // 1 image

  // Try extracting width and height from PNG IHDR chunk (bytes 16..24)
  let width = 0;
  let height = 0;
  if (pngBuffer.length >= 24) {
    const rawWidth = pngBuffer.readUInt32BE(16);
    const rawHeight = pngBuffer.readUInt32BE(20);
    width = rawWidth >= 256 ? 0 : rawWidth;
    height = rawHeight >= 256 ? 0 : rawHeight;
  }

  // ICONDIRENTRY (16 bytes)
  const entry = Buffer.alloc(16);
  entry.writeUInt8(width, 0); // Width (0 means 256)
  entry.writeUInt8(height, 1); // Height (0 means 256)
  entry.writeUInt8(0, 2); // Color palette count (0 = no palette)
  entry.writeUInt8(0, 3); // Reserved
  entry.writeUInt16LE(1, 4); // Color planes
  entry.writeUInt16LE(32, 6); // Bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // Size of image data
  entry.writeUInt32LE(22, 12); // Offset where image data begins (6 + 16 = 22)

  return Buffer.concat([header, entry, pngBuffer]);
}

/**
 * Generates a clean 32x32 fallback 1-bit monochrome ICO buffer.
 */
export function createFallbackIco(): Buffer {
  // 6 bytes header + 16 bytes entry + 40 bytes BITMAPINFOHEADER + 8 bytes RGBQUAD + 128 bytes XOR mask + 128 bytes AND mask = 326 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const bmpHeader = Buffer.alloc(40);
  bmpHeader.writeUInt32LE(40, 0); // biSize
  bmpHeader.writeInt32LE(32, 4); // biWidth
  bmpHeader.writeInt32LE(64, 8); // biHeight (double height for XOR + AND masks in ICO)
  bmpHeader.writeUInt16LE(1, 12); // biPlanes
  bmpHeader.writeUInt16LE(1, 14); // biBitCount (1-bit monochrome)
  bmpHeader.writeUInt32LE(0, 16); // biCompression (BI_RGB)
  bmpHeader.writeUInt32LE(256, 20); // biSizeImage

  // Color palette (2 colors: 0 = transparent/white, 1 = dark)
  const palette = Buffer.alloc(8);
  palette.writeUInt32LE(0x00ffffff, 0);
  palette.writeUInt32LE(0x00222222, 4);

  const xorMask = Buffer.alloc(128, 0xaa); // 32x32 alternating dot pattern
  const andMask = Buffer.alloc(128, 0x00); // opaque

  const imageData = Buffer.concat([bmpHeader, palette, xorMask, andMask]);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(32, 0);
  entry.writeUInt8(32, 1);
  entry.writeUInt8(2, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(1, 6);
  entry.writeUInt32LE(imageData.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, imageData]);
}

/**
 * Derives the candidate favicon URL from a web URL origin.
 */
export function buildFaviconUrl(targetUrl: string): string | null {
  try {
    const u = new URL(targetUrl);
    return `${u.origin}/favicon.ico`;
  } catch {
    return null;
  }
}

/**
 * Default implementation of AppIconService.
 * Uses native fetch with strict timeout, verifies format magic bytes, and provides fallback.
 */
export class DefaultAppIconService implements AppIconService {
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: { timeoutMs?: number; fetchFn?: typeof fetch } = {}) {
    this.timeoutMs = options.timeoutMs ?? 3000;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }

  async resolveIcon(url: string, targetPath: string): Promise<string | null> {
    const iconUrl = buildFaviconUrl(url);
    if (!iconUrl) return null;

    try {
      const response = await this.fetchFn(iconUrl, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const rawBuffer = Buffer.from(arrayBuffer);

      if (rawBuffer.length === 0) {
        return null;
      }

      let finalIcoBuffer: Buffer;
      if (isIcoBuffer(rawBuffer)) {
        finalIcoBuffer = rawBuffer;
      } else if (isPngBuffer(rawBuffer)) {
        finalIcoBuffer = wrapPngInIco(rawBuffer);
      } else {
        // Unknown binary format or HTML redirect: do not treat as valid icon
        return null;
      }

      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, finalIcoBuffer);
      return targetPath;
    } catch {
      // Resilient: network errors or timeouts return null without blocking the caller
      return null;
    }
  }
}

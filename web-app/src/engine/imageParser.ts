/**
 * Fast client-side image header parser for JPEG, PNG, and WebP.
 * Reads width, height, and EXIF orientation directly from raw byte streams
 * in sub-milliseconds without triggering expensive full-frame image decoding.
 */

export interface ImageShape {
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'webp' | 'gif' | 'other';
  orientation: number; // EXIF orientation (1-8)
}

export function readImageShapeFromBytes(bytes: Uint8Array): ImageShape | null {
  if (bytes.length < 16) return null;

  // 1. Check JPEG: FF D8
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return parseJpeg(bytes);
  }

  // 2. Check PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return parsePng(bytes);
  }

  // 3. Check WebP: 'RIFF'....'WEBP'
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return parseWebP(bytes);
  }

  // 4. Check GIF: 'GIF87a' or 'GIF89a'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    return { width, height, format: 'gif', orientation: 1 };
  }

  return null;
}

function parseJpeg(bytes: Uint8Array): ImageShape {
  let offset = 2;
  let orientation = 1;
  let width = 0;
  let height = 0;

  while (offset < bytes.length - 8) {
    if (bytes[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;

    if (marker === 0xd9 || marker === 0xda) {
      // End of Image or Start of Scan
      break;
    }

    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];

    // APP1 (EXIF): 0xE1
    if (marker === 0xe1 && length >= 14) {
      const exifHeader = String.fromCharCode(
        bytes[offset + 2],
        bytes[offset + 3],
        bytes[offset + 4],
        bytes[offset + 5]
      );
      if (exifHeader === 'Exif') {
        const exifStart = offset + 8;
        const exifOrientation = readExifOrientation(bytes, exifStart, length - 8);
        if (exifOrientation) orientation = exifOrientation;
      }
    }

    // SOF markers: SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2), SOF3 (0xC3), SOF5-SOF7, SOF9-SOF11, SOF13-SOF15
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)
    ) {
      if (offset + 7 <= bytes.length) {
        height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        break;
      }
    }

    offset += length;
  }

  // EXIF orientations 5, 6, 7, 8 swap width and height
  const finalWidth = orientation >= 5 && orientation <= 8 ? height : width;
  const finalHeight = orientation >= 5 && orientation <= 8 ? width : height;

  return {
    width: finalWidth,
    height: finalHeight,
    format: 'jpeg',
    orientation,
  };
}

function readExifOrientation(bytes: Uint8Array, start: number, maxLen: number): number | null {
  if (start + 8 >= bytes.length) return null;
  const isLittleEndian = bytes[start] === 0x49 && bytes[start + 1] === 0x49;
  const isBigEndian = bytes[start] === 0x4d && bytes[start + 1] === 0x4d;
  if (!isLittleEndian && !isBigEndian) return null;

  const readU16 = (pos: number) => {
    return isLittleEndian
      ? bytes[pos] | (bytes[pos + 1] << 8)
      : (bytes[pos] << 8) | bytes[pos + 1];
  };

  const readU32 = (pos: number) => {
    return isLittleEndian
      ? bytes[pos] | (bytes[pos + 1] << 8) | (bytes[pos + 2] << 16) | (bytes[pos + 3] << 24)
      : (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
  };

  const firstIfdOffset = readU32(start + 4);
  let ifdOffset = start + firstIfdOffset;
  if (ifdOffset + 2 > bytes.length || ifdOffset - start > maxLen) return null;

  const tagCount = readU16(ifdOffset);
  ifdOffset += 2;

  for (let i = 0; i < tagCount; i++) {
    const entryOffset = ifdOffset + i * 12;
    if (entryOffset + 12 > bytes.length) break;
    const tag = readU16(entryOffset);
    if (tag === 0x0112) {
      // Orientation tag
      return readU16(entryOffset + 8);
    }
  }

  return null;
}

function parsePng(bytes: Uint8Array): ImageShape {
  // IHDR chunk: 4 bytes length, 4 bytes "IHDR", 4 bytes width, 4 bytes height
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height, format: 'png', orientation: 1 };
}

function parseWebP(bytes: Uint8Array): ImageShape {
  const type = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (type === 'VP8 ') {
    // Lossy WebP
    const width = ((bytes[26] | (bytes[27] << 8)) & 0x3fff);
    const height = ((bytes[28] | (bytes[29] << 8)) & 0x3fff);
    return { width, height, format: 'webp', orientation: 1 };
  } else if (type === 'VP8L') {
    // Lossless WebP
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + ((((b3 & 0xf) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)));
    return { width, height, format: 'webp', orientation: 1 };
  } else if (type === 'VP8X') {
    // Extended WebP
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height, format: 'webp', orientation: 1 };
  }

  return { width: 0, height: 0, format: 'webp', orientation: 1 };
}

/**
 * Fallback browser loader if byte-inspection is inconclusive or for formats like BMP/TIFF.
 */
export async function readImageShapeWithBrowser(fileOrBlob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(fileOrBlob);
      const { width, height } = bitmap;
      bitmap.close();
      return { width, height };
    } catch {
      // continue to HTMLImageElement fallback
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image in browser'));
    };
    img.src = url;
  });
}

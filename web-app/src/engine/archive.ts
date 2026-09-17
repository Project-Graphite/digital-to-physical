import { unzipSync } from 'fflate';
import type { PageFile } from './types';
import { readImageShapeFromBytes, readImageShapeWithBrowser } from './imageParser';
import { extractRarArchive } from './unrar';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'jpe', 'png', 'gif', 'bmp', 'webp', 'tif', 'tiff']);

function isImageEntry(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.has(ext) && !name.includes('__MACOSX');
}

export function naturalKey(value: string): (string | number)[] {
  return value
    .split(/(\d+)/)
    .filter(Boolean)
    .map((chunk) => (/^\d+$/.test(chunk) ? parseInt(chunk, 10) : chunk.toLowerCase()));
}

export function naturalCompare(a: string, b: string): number {
  const keyA = naturalKey(a);
  const keyB = naturalKey(b);
  const len = Math.max(keyA.length, keyB.length);
  for (let i = 0; i < len; i++) {
    const va = keyA[i];
    const vb = keyB[i];
    if (va === undefined) return -1;
    if (vb === undefined) return 1;
    if (va === vb) continue;
    if (typeof va === 'number' && typeof vb === 'number') return va - vb;
    return String(va).localeCompare(String(vb));
  }
  return 0;
}

export function isZipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export function isRarMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 7 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x61 &&
    bytes[2] === 0x72 &&
    bytes[3] === 0x21 &&
    bytes[4] === 0x1a &&
    bytes[5] === 0x07
  );
}

async function extractViaRar(arrayBuffer: ArrayBuffer): Promise<Record<string, Uint8Array>> {
  const all = await extractRarArchive(arrayBuffer);
  const result: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(all)) {
    if (isImageEntry(name)) result[name] = data;
  }
  return result;
}

function extractViaZip(bytes: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(bytes, { filter: (entry) => isImageEntry(entry.name) });
}

export async function extractComicArchive(
  file: File,
  onProgress?: (progress: number, status: string) => void
): Promise<PageFile[]> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const filename = file.name.toLowerCase();

  onProgress?.(0.15, 'Detecting archive format…');

  let entries: Record<string, Uint8Array> = {};

  const looksLikeRar = isRarMagic(bytes) || (!isZipMagic(bytes) && (filename.endsWith('.cbr') || filename.endsWith('.rar')));

  if (looksLikeRar) {
    try {
      onProgress?.(0.25, 'Unpacking RAR / CBR archive via WebAssembly…');
      entries = await extractViaRar(arrayBuffer);
    } catch {
      if (isZipMagic(bytes)) {
        onProgress?.(0.3, 'Disguised ZIP detected, unpacking…');
        entries = extractViaZip(bytes);
      } else {
        throw new Error('Failed to extract archive: not a valid RAR or ZIP file.');
      }
    }
  } else if (isZipMagic(bytes) || filename.endsWith('.cbz') || filename.endsWith('.zip')) {
    onProgress?.(0.25, 'Unpacking ZIP / CBZ archive…');
    try {
      entries = extractViaZip(bytes);
    } catch {
      if (isRarMagic(bytes)) {
        onProgress?.(0.3, 'Falling back to RAR extraction…');
        entries = await extractViaRar(arrayBuffer);
      } else {
        throw new Error('Failed to extract ZIP/CBZ archive.');
      }
    }
  } else {
    // Unknown header — try ZIP then RAR
    try {
      entries = extractViaZip(bytes);
    } catch {
      entries = await extractViaRar(arrayBuffer);
    }
  }

  const fileEntries = Object.entries(entries);
  if (fileEntries.length === 0) {
    throw new Error('Archive contains no supported comic images (JPEG, PNG, WebP).');
  }

  fileEntries.sort((a, b) => naturalCompare(a[0], b[0]));

  onProgress?.(0.5, 'Inspecting page dimensions…');
  const pages: PageFile[] = [];

  for (let i = 0; i < fileEntries.length; i++) {
    const [name, data] = fileEntries[i];
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const basename = name.split('/').pop() ?? name;
    const fallbackFormat = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg';

    const shape = readImageShapeFromBytes(data);
    let width = shape?.width ?? 0;
    let height = shape?.height ?? 0;
    const format = shape?.format ?? fallbackFormat;

    if (!width || !height) {
      try {
        const blob = new Blob([data as unknown as BlobPart], { type: `image/${format}` });
        const measured = await readImageShapeWithBrowser(blob);
        width = measured.width;
        height = measured.height;
      } catch {
        console.warn(`Could not measure image dimensions for ${basename}`);
        width = 1000;
        height = 1500;
      }
    }

    const objectUrl = URL.createObjectURL(new Blob([data as unknown as BlobPart], { type: `image/${format}` }));

    pages.push({ name: basename, data, width, height, format, objectUrl });

    if (i % 10 === 0 || i === fileEntries.length - 1) {
      onProgress?.(0.5 + 0.5 * ((i + 1) / fileEntries.length), `Processed ${i + 1} of ${fileEntries.length} pages…`);
    }
  }

  return pages;
}

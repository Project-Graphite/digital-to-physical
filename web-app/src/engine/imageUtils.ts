import type { PageFile } from './types';

/** Canvas drawing context for a cropped or composed image region. */
async function loadImage(src: string | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const cleanup = () => { if (typeof src !== 'string') URL.revokeObjectURL(url); };
    img.onload = () => { cleanup(); resolve(img); };
    img.onerror = () => { cleanup(); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

function pageSource(page: PageFile): string | Blob {
  return page.objectUrl ?? new Blob([page.data as unknown as BlobPart], { type: 'image/jpeg' });
}

function fillColor(color?: [number, number, number]): string {
  const [r, g, b] = color ?? [2, 6, 23];
  return `rgb(${r},${g},${b})`;
}

/** Draw the correct region of a page onto a canvas context. Returns [outWidth, outHeight]. */
async function drawPagePart(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  page: PageFile,
  part: 'whole' | 'left' | 'right' | 'cropfill' | 'composed' | 'solid' | 'blank',
  targetWidth: number,
  targetHeight: number,
  color?: [number, number, number],
  insetSource?: PageFile
): Promise<[number, number]> {
  if (part === 'solid') {
    canvas.width = 10;
    canvas.height = 10;
    ctx.fillStyle = fillColor(color);
    ctx.fillRect(0, 0, 10, 10);
    return [10, 10];
  }

  const img = await loadImage(pageSource(page));
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  if (part === 'left') {
    const w = Math.floor(imgW / 2);
    canvas.width = w; canvas.height = imgH;
    ctx.drawImage(img, 0, 0, w, imgH, 0, 0, w, imgH);
    return [w, imgH];
  }

  if (part === 'right') {
    const leftW = Math.floor(imgW / 2);
    const w = imgW - leftW;
    canvas.width = w; canvas.height = imgH;
    ctx.drawImage(img, leftW, 0, w, imgH, 0, 0, w, imgH);
    return [w, imgH];
  }

  if (part === 'cropfill') {
    canvas.width = targetWidth; canvas.height = targetHeight;
    const imgAspect = imgW / imgH;
    const tgtAspect = targetWidth / targetHeight;
    let sx = 0, sy = 0, sw = imgW, sh = imgH;
    if (imgAspect > tgtAspect) {
      sw = Math.round(imgH * tgtAspect);
      sx = Math.round((imgW - sw) / 2);
    } else {
      sh = Math.round(imgW / tgtAspect);
      sy = Math.round((imgH - sh) / 2);
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    return [targetWidth, targetHeight];
  }

  if (part === 'composed') {
    canvas.width = targetWidth; canvas.height = targetHeight;
    ctx.fillStyle = fillColor(color);
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    const inset = await loadImage(pageSource(insetSource ?? page));
    const scale = Math.min(
      (targetWidth * 0.66) / inset.naturalWidth,
      (targetHeight * 0.66) / inset.naturalHeight
    );
    const iw = Math.max(1, Math.round(inset.naturalWidth * scale));
    const ih = Math.max(1, Math.round(inset.naturalHeight * scale));
    const ix = Math.round((targetWidth - iw) / 2);
    const iy = Math.round(targetHeight * 0.13);

    ctx.drawImage(inset, ix, iy, iw, ih);

    const [r, g, b] = color ?? [2, 6, 23];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const lw = Math.max(2, Math.round(targetWidth / 500));
    ctx.strokeStyle = lum < 90 ? 'rgb(245, 245, 245)' : 'rgb(18, 18, 18)';
    ctx.lineWidth = lw;
    ctx.strokeRect(ix - lw, iy - lw, iw + lw * 2, ih + lw * 2);
    return [targetWidth, targetHeight];
  }

  // 'whole'
  canvas.width = imgW; canvas.height = imgH;
  ctx.drawImage(img, 0, 0);
  return [imgW, imgH];
}

// ──────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────

const thumbnailCache = new Map<string, string>();

export async function getDominantColor(page: PageFile): Promise<[number, number, number]> {
  try {
    const img = await loadImage(pageSource(page));
    const canvas = document.createElement('canvas');
    canvas.width = 80; canvas.height = 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [2, 6, 23];
    ctx.drawImage(img, 0, 0, 80, 120);

    const imgData = ctx.getImageData(0, 0, 80, 120).data;
    const counts = new Map<string, { count: number; rgb: [number, number, number] }>();

    for (let i = 0; i < imgData.length; i += 16) {
      const r = Math.round(imgData[i] / 32) * 32;
      const g = Math.round(imgData[i + 1] / 32) * 32;
      const b = Math.round(imgData[i + 2] / 32) * 32;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 30 || lum > 225) continue;
      const key = `${r},${g},${b}`;
      const entry = counts.get(key) ?? { count: 0, rgb: [r, g, b] as [number, number, number] };
      entry.count++;
      counts.set(key, entry);
    }

    if (counts.size === 0) return [2, 6, 23];
    return [...counts.values()].sort((a, b) => b.count - a.count)[0].rgb;
  } catch {
    return [2, 6, 23];
  }
}

export async function generateCropThumbnail(
  page: PageFile,
  part: 'whole' | 'left' | 'right' | 'cropfill' | 'composed' | 'solid' | 'blank',
  targetWidth: number,
  targetHeight: number,
  fillColorArg?: [number, number, number],
  insetSource?: PageFile
): Promise<string> {
  if (part === 'blank') return '';

  const cacheKey = `${page.name}:${part}:${targetWidth}x${targetHeight}:${page.data.byteLength}`;
  const cached = thumbnailCache.get(cacheKey);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  await drawPagePart(ctx, canvas, page, part, targetWidth, targetHeight, fillColorArg, insetSource);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  thumbnailCache.set(cacheKey, dataUrl);
  return dataUrl;
}

export async function cropImageToJpegBytes(
  page: PageFile,
  part: 'whole' | 'left' | 'right' | 'cropfill' | 'composed' | 'solid' | 'blank',
  targetWidth: number,
  targetHeight: number,
  quality = 0.95,
  fillColorArg?: [number, number, number],
  insetSource?: PageFile
): Promise<{ data: Uint8Array; width: number; height: number }> {
  // Byte-for-byte JPEG passthrough — no re-encode, zero quality loss
  if (part === 'whole' && page.format === 'jpeg') {
    return { data: page.data, width: page.width, height: page.height };
  }

  if (part === 'blank') {
    return { data: new Uint8Array(), width: 0, height: 0 };
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const [outWidth, outHeight] = await drawPagePart(
    ctx, canvas, page, part, targetWidth, targetHeight, fillColorArg, insetSource
  );

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality)
  );
  return { data: new Uint8Array(await blob.arrayBuffer()), width: outWidth, height: outHeight };
}

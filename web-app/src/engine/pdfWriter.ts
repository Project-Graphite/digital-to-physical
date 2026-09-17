import type { ConvertOptions, PageLayout, PagePlan } from './types';
import { cropImageToJpegBytes } from './imageUtils';
import { layOutPage, resolveUniformBox } from './planner';

function escapePdfString(value: string): string {
  return value
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function cropMarkOps(layout: PageLayout, lengthPt = 14.0, gapPt = 5.0): string {
  const { trimX: l, trimY: b } = layout;
  const r = l + layout.trimWidth;
  const t = b + layout.trimHeight;

  const segs: [number, number, number, number][] = [
    [l - gapPt - lengthPt, b, l - gapPt, b], [l, b - gapPt - lengthPt, l, b - gapPt],
    [r + gapPt, b, r + gapPt + lengthPt, b], [r, b - gapPt - lengthPt, r, b - gapPt],
    [l - gapPt - lengthPt, t, l - gapPt, t], [l, t + gapPt, l, t + gapPt + lengthPt],
    [r + gapPt, t, r + gapPt + lengthPt, t], [r, t + gapPt, r, t + gapPt + lengthPt],
  ];

  const lines = segs.map(([x1, y1, x2, y2]) =>
    `${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l\n`
  ).join('');

  return `q\n0 G\n0.4 w\n${lines}S\nQ\n`;
}

export async function generatePdf(
  plans: PagePlan[],
  options: ConvertOptions,
  title: string,
  onProgress?: (fraction: number, detail: string) => void
): Promise<Blob> {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let byteOffset = 0;

  function write(data: Uint8Array | string): void {
    const bytes = typeof data === 'string' ? encoder.encode(data) : data;
    chunks.push(bytes);
    byteOffset += bytes.byteLength;
  }

  const objectOffsets: number[] = [];

  function beginObject(n: number): void {
    objectOffsets[n] = byteOffset;
    write(`${n} 0 obj\n`);
  }

  function endObject(): void {
    write('\nendobj\n');
  }

  function writeObject(n: number, body: string): void {
    beginObject(n);
    write(body);
    endObject();
  }

  const uniformBox = resolveUniformBox(plans, options);
  const pageCount = plans.length;

  // Object numbering: 1=Catalog, 2=Pages, then per page: [3+i*3]=Page, [4+i*3]=Content, [5+i*3]=Image
  // Info object comes last
  const infoN = 3 + pageCount * 3;

  // PDF-1.4 header with binary comment to signal binary content
  write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  writeObject(1, '<< /Type /Catalog /Pages 2 0 R >>');

  const kids = Array.from({ length: pageCount }, (_, i) => `${3 + i * 3} 0 R`).join(' ');
  writeObject(2, `<< /Type /Pages /Count ${pageCount} /Kids [ ${kids} ] >>`);

  for (let i = 0; i < pageCount; i++) {
    const plan = plans[i];
    const pageN = 3 + i * 3;
    const contentN = pageN + 1;
    const imageN = pageN + 2;

    onProgress?.((i + 1) / pageCount, `Compiling page ${i + 1} of ${pageCount}…`);

    // Resolve image bytes
    let imageResult: { data: Uint8Array; width: number; height: number } | null = null;
    if (plan.part !== 'blank') {
      imageResult = await cropImageToJpegBytes(
        plan.source,
        plan.part,
        plan.width,
        plan.height,
        options.jpegQuality / 100,
        plan.fillColor,
        plan.insetSource
      );
    }

    const layout = layOutPage(plan.width, plan.height, options, uniformBox);
    const { sheetWidth, sheetHeight, drawWidth, drawHeight, drawX, drawY, trimX, trimY, trimWidth, trimHeight } = layout;

    const trimBox = options.carrierPage !== 'none'
      ? `/TrimBox [${trimX.toFixed(4)} ${trimY.toFixed(4)} ${(trimX + trimWidth).toFixed(4)} ${(trimY + trimHeight).toFixed(4)}] `
      : '';

    const resources = imageResult
      ? `<< /XObject << /Im0 ${imageN} 0 R >> /ProcSet [/PDF /ImageC /ImageB] >>`
      : '<< >>';

    writeObject(
      pageN,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${sheetWidth.toFixed(4)} ${sheetHeight.toFixed(4)}] ${trimBox}/Resources ${resources} /Contents ${contentN} 0 R >>`
    );

    const marks = options.cropMarks && options.carrierPage !== 'none' ? cropMarkOps(layout) : '';
    const contentStr = imageResult
      ? `q\n${drawWidth.toFixed(4)} 0 0 ${drawHeight.toFixed(4)} ${drawX.toFixed(4)} ${drawY.toFixed(4)} cm\n/Im0 Do\nQ\n${marks}`
      : marks;

    const contentBytes = encoder.encode(contentStr);
    writeObject(contentN, `<< /Length ${contentBytes.length} >>\nstream\n${contentStr}\nendstream`);

    if (imageResult && imageResult.data.length > 0) {
      beginObject(imageN);
      write(
        `<< /Type /XObject /Subtype /Image /Width ${imageResult.width} /Height ${imageResult.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageResult.data.length} >>\nstream\n`
      );
      write(imageResult.data);
      write('\nendstream');
      endObject();
    } else {
      // Null object placeholder for blank pages — proper PDF null object
      writeObject(imageN, 'null');
    }
  }

  writeObject(infoN, `<< /Title (${escapePdfString(title)}) /Producer (Graphite digital-to-physical) >>`);

  // Cross-reference table
  const xrefOffset = byteOffset;
  const objCount = infoN + 1;
  write(`xref\n0 ${objCount}\n`);
  write('0000000000 65535 f \n');

  for (let n = 1; n < objCount; n++) {
    const off = objectOffsets[n] ?? 0;
    write(`${off.toString().padStart(10, '0')} 00000 n \n`);
  }

  write(`trailer\n<< /Size ${objCount} /Root 1 0 R /Info ${infoN} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
}

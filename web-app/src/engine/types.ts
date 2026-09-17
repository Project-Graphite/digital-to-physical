/**
 * Core type definitions for digital-to-physical client-side engine.
 */

export interface ConvertOptions {
  paper: string; // 'native' | '16.8x26cm' | '17x26cm' | 'a4' | 'a5' | 'b5' | 'jisb5' | 'letter' | custom
  fitHeightCm: number | null;
  fitWidthCm: number | null;
  dpi: number;
  uniformPages: boolean;
  carrierPage: string; // 'none' | 'a4' | 'a3' | 'letter' | 'tabloid'
  cropMarks: boolean;
  marginMm: number;
  autoRotate: boolean;

  splitLandscape: boolean;
  splitThreshold: number;
  splitMinHeightRatio: number;
  splitOrder: 'ltr' | 'rtl';
  splitFirstPage: boolean;

  spreadAlign: 'off' | 'left-even' | 'left-odd';
  spreadPad: 'after-cover' | 'document-start' | 'inline';

  dropFiller: boolean;
  excludePatterns: string[];
  dropPages: number[];

  backCover: 'keep' | 'page' | 'auto' | 'variant' | 'random-variant' | 'front' | 'color' | 'art' | 'ad';
  backCoverPageNumber: number;

  fillerInterval: number;
  padToMultiple: number;
  jpegQuality: number;
}

export interface PageFile {
  name: string;
  data: Uint8Array;
  width: number;
  height: number;
  format: 'jpeg' | 'png' | 'webp' | 'gif' | 'other';
  objectUrl?: string;
}

export type PagePart = 'whole' | 'left' | 'right' | 'blank' | 'solid' | 'composed' | 'cropfill';

export interface PagePlan {
  source: PageFile;
  part: PagePart;
  width: number;
  height: number;
  fillColor?: [number, number, number];
  insetSource?: PageFile;
}

export interface PageView {
  index: number;
  number: number;
  kind: 'story' | 'spreadLeft' | 'spreadRight' | 'blank' | 'filler' | 'generated';
  label: string;
  source: string;
  pixelWidth: number;
  pixelHeight: number;
  boxAspect: number;
  plan: PagePlan;
}

export interface AuditReport {
  pageCount: number;
  splitCount: number;
  blankCount: number;
  fillerCount: number;
  spreads: number;
  facing: number;
  straddling: number;
  trimCm: [number, number];
  sheetCm: [number, number];
  hasCarrier: boolean;
  warnings: string[];
  multiple: boolean;
  allFacing: boolean;
}

export interface PageLayout {
  sheetWidth: number; // in points (pt)
  sheetHeight: number;
  drawWidth: number;
  drawHeight: number;
  drawX: number;
  drawY: number;
  trimWidth: number;
  trimHeight: number;
  trimX: number;
  trimY: number;
}

export interface PlanResult {
  version: number;
  plans: PagePlan[];
  effectiveOptions: ConvertOptions;
  uniformBox: [number, number] | null;
  pages: PageView[];
  audit: AuditReport;
}

export interface PdfMeasurement {
  name: string;
  bytes: number;
  megabytes: number;
  pageCount: number;
  trimSize: string;
  sheetSize: string;
  blankPages: string;
  maxStretchPct: number;
}

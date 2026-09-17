import type { ConvertOptions, PageFile, PageLayout, PagePlan, PageView } from './types';

export const paperSizesMm: Record<string, [number, number]> = {
  a3: [297.0, 420.0],
  a4: [210.0, 297.0],
  a5: [148.0, 210.0],
  b3: [353.0, 500.0],
  b4: [250.0, 353.0],
  b5: [176.0, 250.0],
  jisb4: [257.0, 364.0],
  jisb5: [182.0, 257.0],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
  tabloid: [279.4, 431.8],
};

const unitsPerInch: Record<string, number> = {
  mm: 25.4,
  cm: 2.54,
  in: 1.0,
  pt: 72.0,
};

export function parsePaperSize(spec: string): [number, number] | null {
  const normalized = (spec || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!normalized || normalized === 'native' || normalized === 'none' || normalized === 'off') {
    return null;
  }
  if (paperSizesMm[normalized]) {
    const [wMm, hMm] = paperSizesMm[normalized];
    return [(wMm * 72.0) / 25.4, (hMm * 72.0) / 25.4];
  }

  const match = normalized.match(/^(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)(mm|cm|in|pt)?$/);
  if (!match) {
    return null;
  }
  const width = parseFloat(match[1]);
  const height = parseFloat(match[2]);
  const unit = match[3] || 'cm';
  const perInch = unitsPerInch[unit] || 2.54;
  return [(width * 72.0) / perInch, (height * 72.0) / perInch];
}

export function referencePageHeight(pages: PageFile[]): number {
  const portraitHeights = pages
    .filter((p) => p.width <= p.height)
    .map((p) => p.height)
    .sort((a, b) => a - b);
  if (portraitHeights.length === 0) return 0;
  const mid = Math.floor(portraitHeights.length / 2);
  return portraitHeights.length % 2 !== 0
    ? portraitHeights[mid]
    : (portraitHeights[mid - 1] + portraitHeights[mid]) / 2;
}

const globCache = new Map<string, RegExp>();

function matchGlob(name: string, pattern: string): boolean {
  let rx = globCache.get(pattern);
  if (!rx) {
    const escaped = pattern
      .toLowerCase()
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    rx = new RegExp(`^${escaped}$`);
    globCache.set(pattern, rx);
  }
  return rx.test(name.toLowerCase());
}


export function selectPageFiles(
  pageFiles: PageFile[],
  minSpreadHeight: number,
  options: ConvertOptions
): PageFile[] {
  const kept: PageFile[] = [];
  const dropSet = new Set(options.dropPages);

  for (let i = 0; i < pageFiles.length; i++) {
    const page = pageFiles[i];
    const position = i + 1;

    if (dropSet.has(position)) continue;

    if (
      options.excludePatterns.some((pattern) => pattern && matchGlob(page.name, pattern.trim()))
    ) {
      continue;
    }

    const isFiller =
      options.dropFiller &&
      page.width >= page.height * options.splitThreshold &&
      page.height < minSpreadHeight;

    if (isFiller) continue;

    kept.push(page);
  }
  return kept;
}

export function spareVariantCoverIndices(pages: PageFile[]): number[] {
  if (pages.length < 3) return [];
  const firstStem = pages[0].name.replace(/\.[^.]+$/, '');
  if (!/\d+$/.test(firstStem)) return [];

  const variants: number[] = [];
  for (let index = 1; index < pages.length; index++) {
    const stem = pages[index].name.replace(/\.[^.]+$/, '');
    if (stem !== firstStem && stem.startsWith(firstStem)) {
      const rest = stem.slice(firstStem.length);
      if (/^[a-z]$/i.test(rest)) {
        variants.push(index);
      }
    }
  }
  return variants;
}

export function chooseBackCover(
  selected: PageFile[],
  options: ConvertOptions,
  advertPool: PageFile[],
  customBackCover?: PageFile
): PagePlan | null {
  if (customBackCover) {
    return {
      source: customBackCover,
      part: 'whole',
      width: customBackCover.width,
      height: customBackCover.height,
    };
  }

  if (options.backCover === 'page') {
    const index = options.backCoverPageNumber - 1;
    if (index >= 0 && index < selected.length) {
      const [chosen] = selected.splice(index, 1);
      return { source: chosen, part: 'whole', width: chosen.width, height: chosen.height };
    }
    return null;
  }

  if (options.backCover === 'random-variant') {
    const variants = spareVariantCoverIndices(selected);
    if (variants.length > 0) {
      const chosenIndex = variants[Math.floor(Math.random() * variants.length)];
      const [chosen] = selected.splice(chosenIndex, 1);
      return { source: chosen, part: 'whole', width: chosen.width, height: chosen.height };
    }
  }

  if (options.backCover === 'variant') {
    const variants = spareVariantCoverIndices(selected);
    if (variants.length > 0) {
      const lastIndex = variants[variants.length - 1];
      const [chosen] = selected.splice(lastIndex, 1);
      return { source: chosen, part: 'whole', width: chosen.width, height: chosen.height };
    }
  }

  if (options.backCover === 'front' && selected.length > 0) {
    const front = selected[0];
    return { source: front, part: 'whole', width: front.width, height: front.height };
  }

  if (options.backCover === 'color' && selected.length > 0) {
    const front = selected[0];
    return {
      source: front,
      part: 'solid',
      width: front.width,
      height: front.height,
      fillColor: [12, 12, 14], // Graphite #0c0c0e
    };
  }

  if ((options.backCover === 'ad' || options.backCover === 'auto') && advertPool.length > 0) {
    const chosen = advertPool[0];
    const front = selected[0] || chosen;
    return { source: chosen, part: 'cropfill', width: front.width, height: front.height };
  }

  if (['art', 'auto', 'random-variant', 'ad'].includes(options.backCover) && selected.length > 0) {
    const front = selected[0];
    const variants = spareVariantCoverIndices(selected);
    const inset = variants.length > 0 ? selected.splice(variants[variants.length - 1], 1)[0] : front;
    return {
      source: front,
      part: 'composed',
      width: front.width,
      height: front.height,
      fillColor: [12, 12, 14], // Graphite #0c0c0e
      insetSource: inset,
    };
  }

  return null;
}

export function alignSpreads(plans: PagePlan[], options: ConvertOptions): PagePlan[] {
  if (options.spreadAlign === 'off' || plans.length === 0) {
    return plans;
  }

  const wantedParity = options.spreadAlign === 'left-even' ? 0 : 1;
  const leftIndices = plans
    .map((p, idx) => (p.part === 'left' ? idx : -1))
    .filter((idx) => idx !== -1);

  if (leftIndices.length === 0) return plans;

  if (options.spreadPad === 'inline') {
    const padded: PagePlan[] = [];
    for (const plan of plans) {
      if (plan.part === 'left' && padded.length % 2 !== wantedParity) {
        padded.push({
          source: plan.source,
          part: 'blank',
          width: plan.width,
          height: plan.height,
        });
      }
      padded.push(plan);
    }
    return padded;
  }

  const alignedWithout = leftIndices.filter((idx) => idx % 2 === wantedParity).length;
  const alignedWith = leftIndices.length - alignedWithout;

  if (alignedWith < alignedWithout) {
    return plans;
  }

  const insertAt = options.spreadPad === 'document-start' ? 0 : Math.min(1, leftIndices[0]);
  const blank: PagePlan = {
    source: plans[insertAt]?.source || plans[0].source,
    part: 'blank',
    width: plans[0].width,
    height: plans[0].height,
  };

  return [...plans.slice(0, insertAt), blank, ...plans.slice(insertAt)];
}

export function padForBooklet(
  plans: PagePlan[],
  backCover: PagePlan | null,
  options: ConvertOptions,
  tailIsBackCover: boolean = false
): PagePlan[] {
  const multiple = options.padToMultiple;
  const tail = backCover ? 1 : 0;
  let result = [...plans];

  if (multiple > 1 && (result.length > 0 || backCover)) {
    const shortfall = (-(result.length + tail) % multiple + multiple) % multiple;
    if (shortfall > 0) {
      const filler = result[result.length - 1] || backCover!;
      const blanks: PagePlan[] = Array.from({ length: shortfall }, () => ({
        source: filler.source,
        part: 'blank',
        width: filler.width,
        height: filler.height,
      }));

      if (!backCover && tailIsBackCover && result.length > 0) {
        result = [...result.slice(0, -1), ...blanks, ...result.slice(-1)];
      } else {
        result = [...result, ...blanks];
      }
    }
  }

  if (backCover) {
    result.push(backCover);
  }
  return result;
}

export function distributeFiller(
  plans: PagePlan[],
  backCover: PagePlan | null,
  options: ConvertOptions,
  tailIsBackCover: boolean,
  advertPool: PageFile[]
): PagePlan[] {
  const interval = options.fillerInterval;
  if (advertPool.length === 0 || interval <= 0) {
    return padForBooklet(plans, backCover, options, tailIsBackCover);
  }

  const aligning = options.spreadAlign !== 'off';
  const wantedParity = options.spreadAlign === 'left-even' ? 0 : 1;
  const pageCount = plans.length;
  const spreadLefts = aligning
    ? plans.map((p, i) => (p.part === 'left' ? i : -1)).filter((i) => i !== -1)
    : [];

  const gaps: [number, number][] = [];
  let cursor = 2;
  for (const left of spreadLefts) {
    gaps.push([Math.min(cursor, Math.max(left, 2)), left]);
    cursor = left + 2;
  }
  const lastPosition = tailIsBackCover ? pageCount - 1 : pageCount;
  gaps.push([Math.min(cursor, Math.max(lastPosition, 0)), Math.max(lastPosition, 0)]);

  const requiredParity: (number | null)[] = [];
  let previous = 0;
  for (const left of spreadLefts) {
    const cumulative = ((wantedParity - left) % 2 + 2) % 2;
    requiredParity.push(((cumulative - previous) % 2 + 2) % 2);
    previous = cumulative;
  }
  requiredParity.push(null);

  const counts: number[] = [];
  for (let i = 0; i < gaps.length; i++) {
    const [low, high] = gaps[i];
    const parity = requiredParity[i];
    const span = Math.max(high - low, 0);
    let count = span > 0 && interval > 0 ? Math.max(0, Math.round(span / interval)) : 0;
    if (parity !== null && count % 2 !== parity) {
      count = span >= (count + 1) * 2 ? count + 1 : Math.max(count - 1, parity);
    }
    counts.push(count);
  }

  if (options.padToMultiple > 1) {
    const tail = backCover ? 1 : 0;
    const totalCurrent = pageCount + counts.reduce((a, b) => a + b, 0) + tail;
    const shortfall = ((-totalCurrent % options.padToMultiple) + options.padToMultiple) % options.padToMultiple;
    counts[counts.length - 1] += shortfall % 2;

    const headroom = (idx: number) => {
      const [low, high] = gaps[idx];
      return (high - low) / 3.0 - counts[idx];
    };

    for (let s = 0; s < Math.floor(shortfall / 2); s++) {
      let maxIdx = 0;
      let maxVal = headroom(0);
      for (let g = 1; g < gaps.length; g++) {
        const val = headroom(g);
        if (val > maxVal) {
          maxVal = val;
          maxIdx = g;
        }
      }
      counts[maxIdx] += 2;
    }
  }

  const positions: number[] = [];
  for (let i = 0; i < gaps.length; i++) {
    const [low, high] = gaps[i];
    const count = counts[i];
    if (count <= 0) continue;
    const span = Math.max(high - low, 0);
    for (let step = 0; step < count; step++) {
      positions.push(Math.min(low + Math.round((span * (step + 1)) / (count + 1)), high));
    }
  }
  positions.sort((a, b) => a - b);

  const blankLike = (ref: PagePlan): PagePlan => ({
    source: ref.source,
    part: 'blank',
    width: ref.width,
    height: ref.height,
  });

  const spread: PagePlan[] = [];
  let nextInsert = 0;
  for (let index = 0; index < plans.length; index++) {
    while (nextInsert < positions.length && positions[nextInsert] === index) {
      spread.push(blankLike(plans[index]));
      nextInsert++;
    }
    spread.push(plans[index]);
  }
  while (nextInsert < positions.length) {
    spread.push(blankLike(plans[plans.length - 1]));
    nextInsert++;
  }

  if (backCover) {
    spread.push(backCover);
  }
  return spread;
}

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: T[], seedStr: string): T[] {
  if (items.length <= 1) return [...items];
  const rng = mulberry32(hashString(seedStr));
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

export function fillBlankPages(
  plans: PagePlan[],
  advertPool: PageFile[],
  seedKey: string = ''
): PagePlan[] {
  if (advertPool.length === 0 || plans.length === 0) return plans;

  // Deduplicate unique adverts in pool by name
  const uniqueMap = new Map<string, PageFile>();
  for (const ad of advertPool) {
    if (!uniqueMap.has(ad.name)) {
      uniqueMap.set(ad.name, ad);
    }
  }
  const uniqueAds = Array.from(uniqueMap.values());
  if (uniqueAds.length === 0) return plans;

  const poolOrder = seededShuffle(uniqueAds, seedKey);

  // Identify all slots in the comic intended for adverts:
  // 1. Any plan where part === 'blank' (interior padding / rhythm filler)
  // 2. The final page IF it is a back cover advert (part === 'cropfill' and source is in uniqueMap)
  const lastIdx = plans.length - 1;
  const isBackCoverAd =
    lastIdx >= 0 &&
    plans[lastIdx].part === 'cropfill' &&
    uniqueMap.has(plans[lastIdx].source.name);

  interface AdSlot {
    planIndex: number;
    isBackCover: boolean;
  }

  const adSlots: AdSlot[] = [];
  for (let i = 0; i < plans.length; i++) {
    if (i === lastIdx && isBackCoverAd) {
      adSlots.push({ planIndex: i, isBackCover: true });
    } else if (plans[i].part === 'blank') {
      adSlots.push({ planIndex: i, isBackCover: false });
    }
  }

  if (adSlots.length === 0) return plans;

  // Copy plans so we don't mutate input
  const filled = [...plans];

  // Distribute adverts sequentially across all advert slots (reading order).
  // Because slots are filled consecutively modulo poolOrder.length:
  // - Every advert appears either floor(K/N) or floor(K/N) + 1 times.
  // - Difference between max and min frequency is guaranteed to be <= 1.
  // - Spacing between repeated adverts is maximized (at least N slots).
  // - For N >= 2, the back cover is guaranteed never to be identical to the preceding filler page.
  for (let s = 0; s < adSlots.length; s++) {
    const slot = adSlots[s];
    const advert = poolOrder[s % poolOrder.length];
    const target = filled[slot.planIndex];

    filled[slot.planIndex] = {
      ...target,
      source: advert,
      part: 'cropfill',
    };
  }

  return filled;
}

export function planPages(
  pageFiles: PageFile[],
  options: ConvertOptions,
  advertPool: PageFile[] = [],
  customBackCover?: PageFile
): PagePlan[] {
  const minSpreadHeight = referencePageHeight(pageFiles) * options.splitMinHeightRatio;
  const selected = selectPageFiles(pageFiles, minSpreadHeight, options);

  const backCover = chooseBackCover(selected, options, advertPool, customBackCover);

  const plans: PagePlan[] = [];
  for (let index = 0; index < selected.length; index++) {
    const page = selected[index];
    const isSpread =
      options.splitLandscape &&
      page.width >= page.height * options.splitThreshold &&
      page.height >= minSpreadHeight &&
      (index > 0 || options.splitFirstPage);

    if (!isSpread) {
      plans.push({ source: page, part: 'whole', width: page.width, height: page.height });
      continue;
    }

    const leftWidth = Math.floor(page.width / 2);
    const rightWidth = page.width - leftWidth;

    const halves: PagePlan[] = [
      { source: page, part: 'left', width: leftWidth, height: page.height },
      { source: page, part: 'right', width: rightWidth, height: page.height },
    ];
    if (options.splitOrder === 'rtl') {
      halves.reverse();
    }
    plans.push(...halves);
  }

  const seedKey = pageFiles[0]?.name || '';

  return fillBlankPages(
    distributeFiller(
      alignSpreads(plans, options),
      backCover,
      options,
      options.backCover === 'keep',
      advertPool
    ),
    advertPool,
    seedKey
  );
}

export function resolveFittedDpi(plans: PagePlan[], options: ConvertOptions): ConvertOptions {
  if (options.fitHeightCm === null && options.fitWidthCm === null) {
    return options;
  }
  const realPages = plans.filter((p) => p.part !== 'blank');
  if (realPages.length === 0) return options;

  // Find dominant dimensions
  const counts: Record<string, number> = {};
  for (const p of realPages) {
    const key = `${p.width}x${p.height}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  const [dominantKey] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const [dominantWidth, dominantHeight] = dominantKey.split('x').map(Number);

  let dpi = options.dpi;
  if (options.fitHeightCm !== null) {
    dpi = dominantHeight / (options.fitHeightCm / 2.54);
  } else if (options.fitWidthCm !== null) {
    dpi = dominantWidth / (options.fitWidthCm / 2.54);
  }

  return {
    ...options,
    dpi,
    paper: 'native',
  };
}

export function pageGeometry(
  pixelWidth: number,
  pixelHeight: number,
  options: ConvertOptions
): [number, number, number, number, number, number] {
  const paper = parsePaperSize(options.paper);
  if (!paper) {
    const drawWidth = (pixelWidth * 72.0) / options.dpi;
    const drawHeight = (pixelHeight * 72.0) / options.dpi;
    return [drawWidth, drawHeight, drawWidth, drawHeight, 0.0, 0.0];
  }

  let [pageWidth, pageHeight] = paper;
  if (options.autoRotate && pixelWidth > pixelHeight !== pageWidth > pageHeight) {
    [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }
  const marginPt = (options.marginMm * 72.0) / 25.4;
  const availableWidth = Math.max(pageWidth - 2 * marginPt, 1.0);
  const availableHeight = Math.max(pageHeight - 2 * marginPt, 1.0);
  const scale = Math.min(availableWidth / pixelWidth, availableHeight / pixelHeight);
  const drawWidth = pixelWidth * scale;
  const drawHeight = pixelHeight * scale;

  return [
    pageWidth,
    pageHeight,
    drawWidth,
    drawHeight,
    (pageWidth - drawWidth) / 2.0,
    (pageHeight - drawHeight) / 2.0,
  ];
}

export function resolveUniformBox(
  plans: PagePlan[],
  options: ConvertOptions
): [number, number] | null {
  if (!options.uniformPages) return null;
  const realPages = plans.filter((p) => p.part !== 'blank');
  if (realPages.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const p of realPages) {
    const key = `${p.width}x${p.height}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  const [dominantKey] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const [dominantWidth, dominantHeight] = dominantKey.split('x').map(Number);
  const [boxWidth, boxHeight] = pageGeometry(dominantWidth, dominantHeight, options);
  return [boxWidth, boxHeight];
}

export function layOutPage(
  pixelWidth: number,
  pixelHeight: number,
  options: ConvertOptions,
  uniformBox: [number, number] | null
): PageLayout {
  let nominalWidth: number;
  let nominalHeight: number;
  let drawWidth: number;
  let drawHeight: number;
  let drawX: number;
  let drawY: number;

  if (uniformBox === null) {
    [nominalWidth, nominalHeight, drawWidth, drawHeight, drawX, drawY] = pageGeometry(
      pixelWidth,
      pixelHeight,
      options
    );
  } else {
    [nominalWidth, nominalHeight] = uniformBox;
    drawWidth = nominalWidth;
    drawHeight = nominalHeight;
    drawX = 0;
    drawY = 0;
  }

  const carrier = parsePaperSize(options.carrierPage);
  if (!carrier) {
    return {
      sheetWidth: nominalWidth,
      sheetHeight: nominalHeight,
      drawWidth,
      drawHeight,
      drawX,
      drawY,
      trimWidth: nominalWidth,
      trimHeight: nominalHeight,
      trimX: 0,
      trimY: 0,
    };
  }

  let [sheetWidth, sheetHeight] = carrier;
  if (options.autoRotate && nominalWidth > nominalHeight !== sheetWidth > sheetHeight) {
    [sheetWidth, sheetHeight] = [sheetHeight, sheetWidth];
  }

  if (nominalWidth > sheetWidth + 0.01 || nominalHeight > sheetHeight + 0.01) {
    return {
      sheetWidth: nominalWidth,
      sheetHeight: nominalHeight,
      drawWidth,
      drawHeight,
      drawX,
      drawY,
      trimWidth: nominalWidth,
      trimHeight: nominalHeight,
      trimX: 0,
      trimY: 0,
    };
  }

  const padX = (sheetWidth - nominalWidth) / 2.0;
  const padY = (sheetHeight - nominalHeight) / 2.0;

  return {
    sheetWidth,
    sheetHeight,
    drawWidth,
    drawHeight,
    drawX: drawX + padX,
    drawY: drawY + padY,
    trimWidth: nominalWidth,
    trimHeight: nominalHeight,
    trimX: padX,
    trimY: padY,
  };
}

export function describePlan(
  plan: PagePlan,
  isAdvert: boolean
): { kind: PageView['kind']; label: string } {
  if (plan.part === 'blank') return { kind: 'blank', label: 'blank page' };
  if (plan.part === 'solid') return { kind: 'generated', label: 'flat colour back cover' };
  if (plan.part === 'composed') return { kind: 'generated', label: 'composed back cover' };
  if (plan.part === 'cropfill' || isAdvert) return { kind: 'filler', label: 'advert' };
  if (plan.part === 'left') return { kind: 'spreadLeft', label: 'spread, left half' };
  if (plan.part === 'right') return { kind: 'spreadRight', label: 'spread, right half' };
  return { kind: 'story', label: 'page' };
}

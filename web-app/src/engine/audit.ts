import type { AuditReport, ConvertOptions, PagePlan, PageLayout } from './types';

const wantedParity = 1; // left-odd (0-indexed: index 1, 3, 5...)
const maxFillerStack = 2;
const minStoryRun = 2;
const pointsPerCm = 72.0 / 2.54;

export function checkSpreads(plans: PagePlan[]): {
  spreads: number;
  facing: number;
  straddling: number;
  problems: string[];
} {
  const problems: string[] = [];
  let spreads = 0;
  let facing = 0;

  for (let index = 0; index < plans.length; index++) {
    const plan = plans[index];
    if (plan.part !== 'left') continue;

    spreads++;
    const following = index + 1 < plans.length ? plans[index + 1] : null;

    if (!following || following.part !== 'right') {
      problems.push(
        `halves SPLIT APART at page ${index + 1}: ${plan.source.name} followed by ${
          following ? following.part : 'end of book'
        }`
      );
    } else if (following.source.name !== plan.source.name) {
      problems.push(`page ${index + 1}: right half is from a different image file`);
    }

    if (index % 2 === wantedParity) {
      facing++;
    }
  }

  return {
    spreads,
    facing,
    straddling: spreads - facing,
    problems,
  };
}

export function checkFiller(
  plans: PagePlan[],
  advertNames: Set<string>
): {
  filler: number;
  pages: number;
  problems: string[];
} {
  if (advertNames.size === 0 && !plans.some((p) => p.part === 'cropfill')) {
    return { filler: 0, pages: plans.length, problems: [] };
  }

  const isFiller = plans.map(
    (plan) => advertNames.has(plan.source.name) || plan.part === 'cropfill'
  );

  const problems: string[] = [];
  let run = 0;
  let story = 0;

  // Final page is back cover; filler there is intended
  for (let index = 0; index < isFiller.length - 1; index++) {
    if (isFiller[index]) {
      run++;
      if (run > maxFillerStack) {
        problems.push(`${run} filler pages stacked ending at page ${index + 1}`);
      }
      if (story > 0 && story < minStoryRun) {
        problems.push(`filler at page ${index + 1} after only ${story} story page(s)`);
      }
      story = 0;
    } else {
      run = 0;
      story++;
    }
  }

  // Check advert pool distribution balance:
  // The difference between max and min frequency across all adverts in the pool must be at most 1
  if (advertNames.size > 0) {
    const counts = new Map<string, number>();
    for (const name of advertNames) {
      counts.set(name, 0);
    }
    for (const plan of plans) {
      if (advertNames.has(plan.source.name)) {
        counts.set(plan.source.name, (counts.get(plan.source.name) || 0) + 1);
      }
    }
    const freqValues = Array.from(counts.values());
    if (freqValues.length > 0) {
      const maxFreq = Math.max(...freqValues);
      const minFreq = Math.min(...freqValues);
      if (maxFreq - minFreq > 1) {
        problems.push(
          `Advert pool imbalance: frequencies vary by ${maxFreq - minFreq} (max: ${maxFreq}×, min: ${minFreq}×)`
        );
      }
    }
  }

  const fillerCount = isFiller.filter(Boolean).length;
  return {
    filler: fillerCount,
    pages: plans.length,
    problems,
  };
}

export function runAudit(
  plans: PagePlan[],
  options: ConvertOptions,
  firstPageLayout: PageLayout,
  advertNames: Set<string>
): AuditReport {
  const spreadRes = checkSpreads(plans);
  const fillerRes = checkFiller(plans, advertNames);

  const warnings = [...spreadRes.problems, ...fillerRes.problems];
  const pageCount = plans.length;

  if (options.padToMultiple > 0 && pageCount % options.padToMultiple !== 0) {
    warnings.push(`${pageCount} pages is not a multiple of ${options.padToMultiple}`);
  }
  if (options.padToMultiple === 0 && pageCount % 4 !== 0) {
    warnings.push(
      `${pageCount} pages is not a multiple of 4; a saddle-stitch binder will pad the end and blank your back cover`
    );
  }

  const multiple = pageCount % 4 === 0;
  const allFacing = spreadRes.spreads === 0 || spreadRes.straddling === 0;

  return {
    pageCount,
    splitCount: spreadRes.spreads,
    blankCount: plans.filter((p) => p.part === 'blank').length,
    fillerCount: fillerRes.filler,
    spreads: spreadRes.spreads,
    facing: spreadRes.facing,
    straddling: spreadRes.straddling,
    trimCm: [
      Math.round((firstPageLayout.trimWidth / pointsPerCm) * 100) / 100,
      Math.round((firstPageLayout.trimHeight / pointsPerCm) * 100) / 100,
    ],
    sheetCm: [
      Math.round((firstPageLayout.sheetWidth / pointsPerCm) * 100) / 100,
      Math.round((firstPageLayout.sheetHeight / pointsPerCm) * 100) / 100,
    ],
    hasCarrier: options.carrierPage !== 'none',
    warnings,
    multiple,
    allFacing,
  };
}

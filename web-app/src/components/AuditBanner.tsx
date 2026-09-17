import type { AuditReport } from '../engine/types';

export function AuditBanner({ audit }: { audit: AuditReport | null }) {
  if (!audit) return null;

  const isGood = audit.multiple && audit.allFacing && audit.warnings.length === 0;

  return (
    <div className={`audit-card ${isGood ? 'good' : 'warn'}`}>
      {/* 1. Multiple of 4 check */}
      <div className="audit-row">
        <span className={`audit-dot ${audit.multiple ? 'good' : 'warn'}`} />
        <span>
          {audit.multiple
            ? `${audit.pageCount} pages — a multiple of 4, so a saddle-stitch binder folds it cleanly.`
            : `${audit.pageCount} pages is not a multiple of 4 — a commercial binder will pad the end with blanks and push your back cover.`}
        </span>
      </div>

      {/* 2. Spreads facing check */}
      {audit.spreads > 0 && (
        <div className="audit-row">
          <span className={`audit-dot ${audit.straddling === 0 ? 'good' : 'warn'}`} />
          <span>
            {audit.straddling === 0
              ? `${audit.spreads} split spread${
                  audit.spreads === 1 ? '' : 's'
                }, every pair facing across the fold once bound.`
              : `${audit.straddling} of ${audit.spreads} split spreads straddle a page turn (halves land on opposite sides).`}
          </span>
        </div>
      )}

      {/* 3. Filler adverts check */}
      {audit.fillerCount > 0 ? (
        <div className="audit-row">
          <span className="audit-dot good" />
          <span>
            {audit.fillerCount} padding page{audit.fillerCount === 1 ? '' : 's'} filled with period adverts (frequencies balanced within &plusmn;1).
          </span>
        </div>
      ) : audit.blankCount > 0 ? (
        <div className="audit-row">
          <span className="audit-dot warn" />
          <span>
            {audit.blankCount} blank padding page{audit.blankCount === 1 ? '' : 's'} — add images to the advert pool to fill them.
          </span>
        </div>
      ) : null}

      {/* 4. Placement and rhythm warnings */}
      {audit.warnings.length > 0 && (
        <ul className="audit-warnings">
          {audit.warnings.map((warn, i) => (
            <li key={i}>{warn}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

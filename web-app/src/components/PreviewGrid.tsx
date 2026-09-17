import { useEffect, useState } from 'react';
import type { PageView } from '../engine/types';
import { generateCropThumbnail } from '../engine/imageUtils';
import { BookOpen } from 'lucide-react';

interface PreviewGridProps {
  pages: PageView[];
  empty: boolean;
}

function PageCard({ page }: { page: PageView }) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (page.kind === 'blank') return;

    generateCropThumbnail(
      page.plan.source,
      page.plan.part,
      page.pixelWidth,
      page.pixelHeight,
      page.plan.fillColor,
      page.plan.insetSource
    ).then((url) => {
      if (active) setThumbUrl(url);
    });

    return () => {
      active = false;
    };
  }, [
    page.kind,
    page.plan.source,
    page.plan.part,
    page.pixelWidth,
    page.pixelHeight,
    page.plan.fillColor,
    page.plan.insetSource,
  ]);

  const tagClass =
    page.kind === 'spreadLeft' || page.kind === 'spreadRight'
      ? 'spread'
      : page.kind === 'filler'
      ? 'filler'
      : page.kind === 'blank'
      ? 'blank'
      : page.kind === 'generated'
      ? 'generated'
      : 'story';

  const cardClass =
    page.kind === 'spreadLeft'
      ? 'spread-left'
      : page.kind === 'spreadRight'
      ? 'spread-right'
      : '';

  return (
    <div className={`page-card ${cardClass}`}>
      <div
        className={`page-frame ${page.kind === 'blank' ? 'blank-page' : ''}`}
        style={{ aspectRatio: String(page.boxAspect) }}
      >
        {page.kind === 'blank' ? (
          <span>BLANK PAGE</span>
        ) : thumbUrl ? (
          <img src={thumbUrl} alt={`Page ${page.number}`} loading="lazy" />
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Loading…</div>
        )}
      </div>

      <div className="page-foot">
        <span className="page-num">#{page.number}</span>
        <span className={`page-tag ${tagClass}`}>{page.label}</span>
        <span className="page-source" title={page.source}>
          {page.kind === 'blank' ? '' : page.source}
        </span>
      </div>
    </div>
  );
}

export function PreviewGrid({ pages, empty }: PreviewGridProps) {
  if (empty) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <BookOpen size={48} />
        </div>
        <h3>Drop a comic archive to begin</h3>
        <p>
          Every page of the finished PDF will appear here in exact binding sequence — splits,
          stretches, adverts, blanks, and back covers, framed to real physical sheet proportions.
        </p>
        <p className="empty-legal">
          Print only what you have the right to print: personal work, commissioned art,
          public-domain material, or licensed digital backups.
        </p>
      </div>
    );
  }

  return (
    <div className="page-grid">
      {pages.map((page) => (
        <PageCard key={`${page.index}-${page.source}-${page.plan.part}`} page={page} />
      ))}
    </div>
  );
};

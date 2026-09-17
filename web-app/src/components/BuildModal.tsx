import { Download, CheckCircle, X } from 'lucide-react';
import type { PdfMeasurement } from '../engine/types';

interface BuildModalProps {
  building: boolean;
  progress: number;
  statusText: string;
  pdfBlob: Blob | null;
  measurement: PdfMeasurement | null;
  onClose: () => void;
}

export function BuildModal({
  building,
  progress,
  statusText,
  pdfBlob,
  measurement,
  onClose,
}: BuildModalProps) {
  if (!building && !pdfBlob) return null;

  const handleDownload = () => {
    if (!pdfBlob || !measurement) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = Object.assign(document.createElement('a'), { href: url, download: measurement.name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  return (
    <div className="modal-overlay" onClick={() => !building && onClose()}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="modal-title">
            {building ? 'Compiling PDF…' : 'PDF Ready for Print'}
          </div>
          {!building && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {building ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>{statusText || 'Processing pages…'}</span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Embedding baseline JPEGs directly and assembling saddle-stitch booklet geometry…
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--accent-emerald)' }}>
              <CheckCircle size={28} />
              <span style={{ fontWeight: 600 }}>Assembly Complete</span>
            </div>

            {measurement && (
              <div className="modal-stats">
                <div>
                  <span>Finished Size</span>
                  <b>{measurement.trimSize} cm</b>
                </div>
                <div>
                  <span>Total Pages</span>
                  <b>{measurement.pageCount} pages</b>
                </div>
                <div>
                  <span>File Size</span>
                  <b>{measurement.megabytes} MB</b>
                </div>
                <div>
                  <span>Blank Pages</span>
                  <b>{measurement.blankPages || 'None'}</b>
                </div>
              </div>
            )}

            <button
              type="button"
              className="btn-primary"
              style={{ justifyContent: 'center', padding: '0.75rem 1.5rem', fontSize: '1rem' }}
              onClick={handleDownload}
            >
              <Download size={18} /> Download {measurement?.megabytes} MB PDF
            </button>
          </>
        )}
      </div>
    </div>
  );
}

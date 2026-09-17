import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Download,
  Printer,
  FileCheck2,
  FileWarning
} from 'lucide-react';
import type {
  ConvertOptions,
  PageFile,
  PageView,
  PlanResult,
  PdfMeasurement
} from './engine/types';
import { extractComicArchive } from './engine/archive';
import {
  planPages,
  resolveFittedDpi,
  resolveUniformBox,
  layOutPage,
  describePlan
} from './engine/planner';
import { runAudit } from './engine/audit';
import { generatePdf } from './engine/pdfWriter';
import { readImageShapeWithBrowser } from './engine/imageParser';

import { DropZone } from './components/DropZone';
import { SettingsPanel } from './components/SettingsPanel';
import { AuditBanner } from './components/AuditBanner';
import { PreviewGrid } from './components/PreviewGrid';
import { BuildModal } from './components/BuildModal';

const defaultOptions: ConvertOptions = {
  paper: '16.8x26cm',
  fitHeightCm: null,
  fitWidthCm: null,
  dpi: 300,
  uniformPages: true,
  carrierPage: 'none',
  cropMarks: false,
  marginMm: 0,
  autoRotate: false,

  splitLandscape: true,
  splitThreshold: 1.15,
  splitMinHeightRatio: 0.7,
  splitOrder: 'ltr',
  splitFirstPage: false,

  spreadAlign: 'left-odd',
  spreadPad: 'inline',

  dropFiller: true,
  excludePatterns: ['z*'],
  dropPages: [],

  backCover: 'auto',
  backCoverPageNumber: 2,

  fillerInterval: 0,
  padToMultiple: 4,
  jpegQuality: 95,
};

export function App() {
  const [archiveName, setArchiveName] = useState<string | null>(null);
  const [pageFiles, setPageFiles] = useState<PageFile[]>([]);
  const [advertPool, setAdvertPool] = useState<PageFile[]>([]);
  const [customBackCover, setCustomBackCover] = useState<PageFile | undefined>(undefined);
  const [options, setOptions] = useState<ConvertOptions>(defaultOptions);

  // Archive loading state
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractStatus, setExtractStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PDF Build state
  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStatus, setBuildStatus] = useState('');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfMeasurement, setPdfMeasurement] = useState<PdfMeasurement | null>(null);

  // Window drag over veil
  const [isWindowDragging, setIsWindowDragging] = useState(false);

  // Extract archive handler
  const handleArchiveFile = useCallback(async (file: File) => {
    setErrorMessage(null);
    setExtracting(true);
    setExtractProgress(0.1);
    setExtractStatus('Reading file…');
    setPdfBlob(null);

    try {
      const extracted = await extractComicArchive(file, (fraction, text) => {
        setExtractProgress(fraction);
        setExtractStatus(text);
      });
      setPageFiles(extracted);
      setArchiveName(file.name);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Failed to extract archive.');
    } finally {
      setExtracting(false);
    }
  }, []);

  // Advert handlers
  const handleAddAdverts = async (files: File[]) => {
    const newAds: PageFile[] = [];
    for (const f of files) {
      try {
        const buf = await f.arrayBuffer();
        const data = new Uint8Array(buf);
        const { width, height } = await readImageShapeWithBrowser(f);
        const objectUrl = URL.createObjectURL(f);
        newAds.push({
          name: f.name,
          data,
          width,
          height,
          format: f.type.includes('png') ? 'png' : 'jpeg',
          objectUrl,
        });
      } catch (e) {
        console.warn(`Could not load advert ${f.name}`, e);
      }
    }
    setAdvertPool((prev) => [...prev, ...newAds]);
  };

  const handleRemoveAdvert = (index: number) => {
    setAdvertPool((prev) => prev.filter((_, i) => i !== index));
  };

  // Custom back cover handlers
  const handleSetCustomBackCover = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const data = new Uint8Array(buf);
      const { width, height } = await readImageShapeWithBrowser(file);
      const objectUrl = URL.createObjectURL(file);
      setCustomBackCover({
        name: file.name,
        data,
        width,
        height,
        format: file.type.includes('png') ? 'png' : 'jpeg',
        objectUrl,
      });
    } catch (e) {
      console.warn('Could not set custom back cover', e);
    }
  };

  const handleClearCustomBackCover = () => {
    setCustomBackCover(undefined);
  };

  // Global window drop listener
  useEffect(() => {
    let depth = 0;

    const handleDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      depth++;
      setIsWindowDragging(true);
    };

    const handleDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setIsWindowDragging(false);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setIsWindowDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) {
        handleArchiveFile(file);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleArchiveFile]);

  // Compute plan and audit report reactively
  const planResult: PlanResult | null = useMemo(() => {
    if (pageFiles.length === 0) return null;

    const plans = planPages(pageFiles, options, advertPool, customBackCover);
    if (plans.length === 0) return null;

    const effectiveOptions = resolveFittedDpi(plans, options);
    const uniformBox = resolveUniformBox(plans, effectiveOptions);
    const firstLayout = layOutPage(plans[0].width, plans[0].height, effectiveOptions, uniformBox);

    const advertNameSet = new Set(advertPool.map((a) => a.name));
    const audit = runAudit(plans, effectiveOptions, firstLayout, advertNameSet);

    const views: PageView[] = plans.map((plan, index) => {
      const layout = layOutPage(plan.width, plan.height, effectiveOptions, uniformBox);
      const isAdvert = advertNameSet.has(plan.source.name);
      const { kind, label } = describePlan(plan, isAdvert);

      return {
        index,
        number: index + 1,
        kind,
        label,
        source: plan.source.name,
        pixelWidth: plan.width,
        pixelHeight: plan.height,
        boxAspect: layout.sheetWidth / Math.max(layout.sheetHeight, 0.001),
        plan,
      };
    });

    return {
      version: 1,
      plans,
      effectiveOptions,
      uniformBox,
      pages: views,
      audit,
    };
  }, [pageFiles, options, advertPool, customBackCover]);

  // Compute usage counts for each advert in the pool
  const advertUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!planResult) return counts;
    const advertNameSet = new Set(advertPool.map((a) => a.name));
    for (const p of planResult.plans) {
      if (advertNameSet.has(p.source.name)) {
        counts[p.source.name] = (counts[p.source.name] || 0) + 1;
      }
    }
    return counts;
  }, [planResult, advertPool]);

  // Build PDF Action
  const handleBuildPdf = async () => {
    if (!planResult) return;
    setBuilding(true);
    setBuildProgress(0.05);
    setBuildStatus('Preparing print geometry…');

    try {
      const title = archiveName ? archiveName.replace(/\.[^.]+$/, '') : 'comic';
      const blob = await generatePdf(
        planResult.plans,
        planResult.effectiveOptions,
        title,
        (frac, detail) => {
          setBuildProgress(frac);
          setBuildStatus(detail);
        }
      );

      const blankIndices = planResult.plans
        .map((p, i) => (p.part === 'blank' ? i + 1 : -1))
        .filter((i) => i !== -1);

      const [trimW, trimH] = planResult.audit.trimCm;
      const [sheetW, sheetH] = planResult.audit.sheetCm;

      const measurement: PdfMeasurement = {
        name: `${title}.pdf`,
        bytes: blob.size,
        megabytes: Math.round((blob.size / (1024 * 1024)) * 100) / 100,
        pageCount: planResult.plans.length,
        trimSize: `${trimW} × ${trimH}`,
        sheetSize: `${sheetW} × ${sheetH}`,
        blankPages: blankIndices.length > 0 ? blankIndices.join(', ') : 'None',
        maxStretchPct: 0,
      };

      setPdfBlob(blob);
      setPdfMeasurement(measurement);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err?.message || 'Failed to generate PDF');
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="app-container">
      {/* Fullscreen drag overlay */}
      {isWindowDragging && (
        <div className="drop-veil">
          <div className="drop-veil-inner">
            <Printer size={48} />
            <span>Drop comic archive to load</span>
          </div>
        </div>
      )}

      {/* Top Bar matching graphite-message-lab Header */}
      <header className="top-bar">
        <a href="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-glyph" />
          </span>
          <span className="brand-name">
            Graphite <span className="sub-label">Digital to Physical</span>
          </span>
        </a>

        <div className="top-summary">
          {planResult ? (
            <>
              <div className="summary-item">
                Pages: <b>{planResult.audit.pageCount}</b>
              </div>
              <div className="summary-item">
                Size: <b>{planResult.audit.trimCm[0]} × {planResult.audit.trimCm[1]} cm</b>
              </div>
              <div className="summary-item">
                Spreads: <b>{planResult.audit.facing}/{planResult.audit.spreads} facing</b>
              </div>
              <div className="summary-item">
                Adverts: <b>{planResult.audit.fillerCount}</b>
              </div>
              <div className="summary-item">
                Blanks: <b>{planResult.audit.blankCount}</b>
              </div>
            </>
          ) : (
            <span className="summary-empty">No archive loaded</span>
          )}
        </div>

        <nav className="top-actions">
          <a
            href="https://message-lab.project-graphite.com/"
            target="_blank"
            rel="noreferrer"
            className="nav-link"
          >
            Message Lab
          </a>
          <a
            href="https://github.com/Project-Graphite/digital-to-physical"
            target="_blank"
            rel="noreferrer"
            className="nav-link"
          >
            Source
          </a>
          <button
            type="button"
            className="btn-build"
            disabled={!planResult || building || extracting}
            onClick={handleBuildPdf}
          >
            <Printer size={15} /> Build PDF
          </button>
          {pdfBlob && pdfMeasurement && (
            <button
              type="button"
              className="btn-download"
              onClick={() => {
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = pdfMeasurement.name;
                a.click();
              }}
            >
              <Download size={15} /> Download {pdfMeasurement.megabytes} MB
            </button>
          )}
        </nav>
      </header>

      {/* Error notification banner */}
      {errorMessage && (
        <div
          style={{
            background: 'rgba(244, 63, 94, 0.15)',
            borderBottom: '1px solid rgba(244, 63, 94, 0.3)',
            color: 'var(--accent-rose)',
            padding: '0.65rem 1.5rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <FileWarning size={16} />
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Main Workspace Layout */}
      <main className="main-layout">
        <aside className="sidebar">
          <DropZone
            onFileSelected={handleArchiveFile}
            archiveName={archiveName}
            pageCount={pageFiles.length}
            loading={extracting}
            statusText={extractStatus}
            progress={extractProgress}
          />

          <SettingsPanel
            options={options}
            onChange={setOptions}
            advertPool={advertPool}
            advertUsageCounts={advertUsageCounts}
            onAddAdverts={handleAddAdverts}
            onRemoveAdvert={handleRemoveAdvert}
            customBackCover={customBackCover}
            onSetCustomBackCover={handleSetCustomBackCover}
            onClearCustomBackCover={handleClearCustomBackCover}
          />
        </aside>

        <section className="preview-pane">
          <div className="preview-header">
            <div className="preview-title">
              <h2>Preview</h2>
              {planResult && (
                <span className="brand-badge">
                  <FileCheck2 size={12} style={{ display: 'inline', marginRight: 3 }} />
                  Live Plan
                </span>
              )}
            </div>
            {planResult && (
              <div className="preview-meta">
                {planResult.audit.pageCount} pages · {planResult.audit.trimCm[0]} ×{' '}
                {planResult.audit.trimCm[1]} cm
                {planResult.audit.hasCarrier &&
                  ` (Sheet: ${planResult.audit.sheetCm[0]} × ${planResult.audit.sheetCm[1]} cm)`}
              </div>
            )}
          </div>

          {planResult && <AuditBanner audit={planResult.audit} />}

          <PreviewGrid
            pages={planResult?.pages || []}
            empty={pageFiles.length === 0 && !extracting}
          />
        </section>
      </main>

      {/* Modal for building PDF */}
      <BuildModal
        building={building}
        progress={buildProgress}
        statusText={buildStatus}
        pdfBlob={pdfBlob}
        measurement={pdfMeasurement}
        onClose={() => {
          setBuilding(false);
          setPdfBlob(null);
        }}
      />
    </div>
  );
}

export default App;

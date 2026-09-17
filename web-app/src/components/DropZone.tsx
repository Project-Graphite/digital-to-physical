import { useState, useRef } from 'react';
import { Archive, UploadCloud, CheckCircle2 } from 'lucide-react';

interface DropZoneProps {
  onFileSelected: (file: File) => void;
  archiveName: string | null;
  pageCount: number;
  loading: boolean;
  statusText: string;
  progress: number;
}

export function DropZone({
  onFileSelected,
  archiveName,
  pageCount,
  loading,
  statusText,
  progress,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="panel">
      <h2>
        <Archive size={16} /> Comic Archive
      </h2>

      <div
        className={`drop-box ${isDragOver ? 'is-dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
      >
        <div className="drop-box-icon">
          <UploadCloud size={32} />
        </div>
        <p>
          Drop a <b>.cbr</b>, <b>.cbz</b>, <b>.rar</b> or <b>.zip</b> here
        </p>
        <small>Client-side decompression for both CBR (RAR) and CBZ (ZIP)</small>
      </div>

      <input
        type="file"
        ref={inputRef}
        style={{ display: 'none' }}
        accept=".cbz,.zip,.cbr,.rar"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onFileSelected(e.target.files[0]);
          }
          e.target.value = '';
        }}
      />

      {loading && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>{statusText || 'Extracting archive…'}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
      )}

      {archiveName && !loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(52, 211, 153, 0.1)',
            border: '1px solid rgba(52, 211, 153, 0.25)',
            padding: '0.6rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
          }}
        >
          <CheckCircle2 size={16} color="var(--accent-emerald)" />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {archiveName}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {pageCount} images extracted
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

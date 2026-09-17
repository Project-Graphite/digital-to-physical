import { useRef } from 'react';
import {
  Maximize2,
  BookOpen,
  EyeOff,
  BookMarked,
  Image as ImageIcon,
  Sparkles,
  Layers
} from 'lucide-react';
import type { ConvertOptions, PageFile } from '../engine/types';

interface SettingsPanelProps {
  options: ConvertOptions;
  onChange: (options: ConvertOptions) => void;
  advertPool: PageFile[];
  advertUsageCounts?: Record<string, number>;
  onAddAdverts: (files: File[]) => void;
  onRemoveAdvert: (index: number) => void;
  customBackCover: PageFile | undefined;
  onSetCustomBackCover: (file: File) => void;
  onClearCustomBackCover: () => void;
}

export function SettingsPanel({
  options,
  onChange,
  advertPool,
  advertUsageCounts,
  onAddAdverts,
  onRemoveAdvert,
  customBackCover,
  onSetCustomBackCover,
  onClearCustomBackCover,
}: SettingsPanelProps) {
  const adInputRef = useRef<HTMLInputElement>(null);
  const backCoverInputRef = useRef<HTMLInputElement>(null);

  const applyPreset = (preset: 'print' | 'faithful' | 'screen') => {
    if (preset === 'print') {
      onChange({
        ...options,
        paper: '16.8x26cm',
        uniformPages: true,
        autoRotate: false,
        splitLandscape: true,
        spreadAlign: 'left-odd',
        spreadPad: 'inline',
        dropFiller: true,
        excludePatterns: ['z*'],
        backCover: 'auto',
        padToMultiple: 4,
        carrierPage: 'none',
      });
    } else if (preset === 'faithful') {
      onChange({
        ...options,
        paper: 'native',
        uniformPages: false,
        autoRotate: true,
        splitLandscape: true,
        spreadAlign: 'off',
        spreadPad: 'after-cover',
        dropFiller: false,
        excludePatterns: [],
        backCover: 'keep',
        padToMultiple: 0,
        fillerInterval: 0,
        carrierPage: 'none',
      });
    } else if (preset === 'screen') {
      onChange({
        ...options,
        paper: 'native',
        uniformPages: false,
        autoRotate: true,
        splitLandscape: true,
        spreadAlign: 'left-even',
        spreadPad: 'document-start',
        dropFiller: true,
        backCover: 'keep',
        padToMultiple: 0,
        carrierPage: 'none',
      });
    }
  };

  const isCustomPaper =
    options.paper !== 'native' &&
    ![
      '16.8x26cm',
      '17x26cm',
      'a4',
      'a5',
      'b5',
      'jisb5',
      'letter',
    ].includes(options.paper);

  return (
    <>
      {/* Presets Panel */}
      <div className="panel">
        <h2>
          <Sparkles size={16} /> Presets
        </h2>
        <div className="preset-grid">
          <button
            type="button"
            className="preset-btn"
            onClick={() => applyPreset('print')}
          >
            <b>Print &amp; bind</b>
            <small>Saddle-stitch ready: 16.8×26cm, facing spreads, multiple of 4</small>
          </button>
          <button
            type="button"
            className="preset-btn"
            onClick={() => applyPreset('faithful')}
          >
            <b>Faithful copy</b>
            <small>Convert only — native size, nothing added, moved, or padded</small>
          </button>
          <button
            type="button"
            className="preset-btn"
            onClick={() => applyPreset('screen')}
          >
            <b>Two-up on screen</b>
            <small>Spreads aligned for a reader showing 2 pages side by side</small>
          </button>
        </div>
      </div>

      {/* Page Size Panel */}
      <div className="panel">
        <h2>
          <Maximize2 size={16} /> Page Size &amp; Sizing
        </h2>

        <label className="field">
          <span className="field-label">Finished size</span>
          <select
            value={isCustomPaper ? 'custom' : options.paper}
            onChange={(e) => {
              const val = e.target.value;
              onChange({ ...options, paper: val === 'custom' ? '16.8x26cm' : val });
            }}
          >
            <option value="native">Native — from the scan's own pixels</option>
            <option value="16.8x26cm">16.8 × 26 cm — US Comic</option>
            <option value="17x26cm">17 × 26 cm</option>
            <option value="a4">A4</option>
            <option value="a5">A5</option>
            <option value="b5">B5</option>
            <option value="jisb5">JIS B5 — Manga</option>
            <option value="letter">Letter</option>
            <option value="custom">Custom…</option>
          </select>
        </label>

        {isCustomPaper && (
          <label className="field">
            <span className="field-label">Custom dimensions</span>
            <input
              type="text"
              value={options.paper}
              placeholder="e.g. 16.8x26cm, 6x9.5in, 152x254mm"
              onChange={(e) => onChange({ ...options, paper: e.target.value })}
            />
            <span className="field-hint">Bare numbers are centimetres.</span>
          </label>
        )}

        {options.paper === 'native' && (
          <>
            <label className="field">
              <span className="field-label">Pin height</span>
              <div className="inline-input">
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="200"
                  placeholder="off"
                  value={options.fitHeightCm ?? ''}
                  onChange={(e) =>
                    onChange({
                      ...options,
                      fitHeightCm: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                />
                <span className="unit">cm</span>
              </div>
              <span className="field-hint">
                Keeps aspect ratio exactly — width follows. Leave empty to use DPI.
              </span>
            </label>

            <label className="field">
              <span className="field-label">DPI</span>
              <input
                type="number"
                min="30"
                max="1200"
                value={options.dpi}
                onChange={(e) => onChange({ ...options, dpi: parseInt(e.target.value) || 300 })}
              />
              <span className="field-hint">Used when no height is pinned.</span>
            </label>
          </>
        )}

        <label className="check-label">
          <input
            type="checkbox"
            checked={options.uniformPages}
            onChange={(e) => onChange({ ...options, uniformPages: e.target.checked })}
          />
          <span>
            <b>One page size for the whole book</b>
            <small>Off-aspect pages take a slight stretch rather than losing artwork.</small>
          </span>
        </label>

        <label className="check-label">
          <input
            type="checkbox"
            checked={options.autoRotate}
            onChange={(e) => onChange({ ...options, autoRotate: e.target.checked })}
          />
          <span>
            <b>Turn sheet for landscape pages</b>
            <small>Turn off to keep every page the same orientation.</small>
          </span>
        </label>

        <label className="field">
          <span className="field-label">Carrier sheet</span>
          <select
            value={options.carrierPage}
            onChange={(e) => onChange({ ...options, carrierPage: e.target.value })}
          >
            <option value="none">None</option>
            <option value="a4">A4</option>
            <option value="a3">A3</option>
            <option value="letter">Letter</option>
            <option value="tabloid">Tabloid</option>
          </select>
          <span className="field-hint">
            Centres page on larger sheet with trim marks so printer "fit to page" doesn't rescale.
          </span>
        </label>

        {options.carrierPage !== 'none' && (
          <label className="check-label">
            <input
              type="checkbox"
              checked={options.cropMarks}
              onChange={(e) => onChange({ ...options, cropMarks: e.target.checked })}
            />
            <span>
              <b>Draw trim / crop marks</b>
              <small>Corner marks in the carrier margin showing where to cut.</small>
            </span>
          </label>
        )}

        <label className="field">
          <span className="field-label">Margin</span>
          <div className="inline-input">
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={options.marginMm}
              onChange={(e) => onChange({ ...options, marginMm: parseFloat(e.target.value) || 0 })}
            />
            <span className="unit">mm</span>
          </div>
        </label>
      </div>

      {/* Spreads Panel */}
      <div className="panel">
        <h2>
          <BookOpen size={16} /> Double-Page Spreads
        </h2>

        <label className="check-label">
          <input
            type="checkbox"
            checked={options.splitLandscape}
            onChange={(e) => onChange({ ...options, splitLandscape: e.target.checked })}
          />
          <span>
            <b>Split wide pages in two</b>
            <small>Divides double-page spreads into separate portrait pages.</small>
          </span>
        </label>

        {options.splitLandscape && (
          <>
            <label className="field">
              <span className="field-label">Make halves face each other</span>
              <select
                value={options.spreadAlign}
                onChange={(e) =>
                  onChange({ ...options, spreadAlign: e.target.value as ConvertOptions['spreadAlign'] })
                }
              >
                <option value="off">Off — keep original page counts</option>
                <option value="left-odd">For binding — page 1 is a right-hand page</option>
                <option value="left-even">For on-screen two-up reading</option>
              </select>
            </label>

            {options.spreadAlign !== 'off' && (
              <label className="field">
                <span className="field-label">Where alignment page goes</span>
                <select
                  value={options.spreadPad}
                  onChange={(e) =>
                    onChange({
                      ...options,
                      spreadPad: e.target.value as ConvertOptions['spreadPad'],
                    })
                  }
                >
                  <option value="after-cover">One page, after the cover</option>
                  <option value="document-start">One page, at the very front</option>
                  <option value="inline">Before every spread that needs it</option>
                </select>
              </label>
            )}

            <label className="field">
              <span className="field-label">Reading order</span>
              <select
                value={options.splitOrder}
                onChange={(e) =>
                  onChange({ ...options, splitOrder: e.target.value as 'ltr' | 'rtl' })
                }
              >
                <option value="ltr">Left to right (Western)</option>
                <option value="rtl">Right to left (Manga)</option>
              </select>
            </label>

            <label className="check-label">
              <input
                type="checkbox"
                checked={options.splitFirstPage}
                onChange={(e) => onChange({ ...options, splitFirstPage: e.target.checked })}
              />
              <span>
                <b>Also split page 1</b>
                <small>Check if issue starts on a wraparound cover.</small>
              </span>
            </label>

            <details className="advanced">
              <summary>Detection thresholds</summary>
              <label className="field">
                <span className="field-label">Counts as spread if width / height &ge;</span>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="4.0"
                  value={options.splitThreshold}
                  onChange={(e) =>
                    onChange({ ...options, splitThreshold: parseFloat(e.target.value) || 1.15 })
                  }
                />
              </label>
              <label className="field">
                <span className="field-label">Minimum height ratio vs typical page</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1.0"
                  value={options.splitMinHeightRatio}
                  onChange={(e) =>
                    onChange({
                      ...options,
                      splitMinHeightRatio: parseFloat(e.target.value) || 0.7,
                    })
                  }
                />
              </label>
            </details>
          </>
        )}
      </div>

      {/* Pages to leave out */}
      <div className="panel">
        <h2>
          <EyeOff size={16} /> Pages to Leave Out
        </h2>

        <label className="check-label">
          <input
            type="checkbox"
            checked={options.dropFiller}
            onChange={(e) => onChange({ ...options, dropFiller: e.target.checked })}
          />
          <span>
            <b>Drop scanner credits &amp; logos</b>
            <small>Landscape images too short to be real spreads.</small>
          </span>
        </label>

        <label className="field">
          <span className="field-label">Remove specific page numbers</span>
          <input
            type="text"
            placeholder="e.g. 7, 8, 13, 14"
            value={options.dropPages.join(', ')}
            onChange={(e) => {
              const pages = e.target.value
                .split(/[,\s]+/)
                .map((s) => parseInt(s.trim()))
                .filter((n) => Number.isInteger(n) && n > 0);
              onChange({ ...options, dropPages: pages });
            }}
          />
          <span className="field-hint">1-based indices, counting front cover as 1.</span>
        </label>

        <label className="field">
          <span className="field-label">Remove files matching pattern</span>
          <input
            type="text"
            placeholder="e.g. z*, xsou*.jpg"
            value={options.excludePatterns.join(', ')}
            onChange={(e) => {
              const patterns = e.target.value
                .split(/[,\s]+/)
                .map((s) => s.trim())
                .filter(Boolean);
              onChange({ ...options, excludePatterns: patterns });
            }}
          />
          <span className="field-hint">Comma-separated filename globs (e.g. z* for release credits).</span>
        </label>
      </div>

      {/* Back Cover */}
      <div className="panel">
        <h2>
          <BookMarked size={16} /> Back Cover
        </h2>

        <label className="field">
          <span className="field-label">Where back cover comes from</span>
          <select
            value={options.backCover}
            onChange={(e) =>
              onChange({ ...options, backCover: e.target.value as ConvertOptions['backCover'] })
            }
          >
            <option value="keep">Keep — scan already ends on back cover</option>
            <option value="page">Move a specific page to the end</option>
            <option value="auto">Automatic — spare variant, else composed</option>
            <option value="variant">A spare variant cover</option>
            <option value="random-variant">A random spare variant cover</option>
            <option value="front">Repeat the front cover</option>
            <option value="color">Front cover's dominant colour</option>
            <option value="art">That colour, with artwork inset</option>
            <option value="ad">An advert from the pool</option>
          </select>
        </label>

        {options.backCover === 'page' && (
          <label className="field">
            <span className="field-label">Which page is the back cover</span>
            <input
              type="number"
              min="1"
              value={options.backCoverPageNumber}
              onChange={(e) =>
                onChange({ ...options, backCoverPageNumber: parseInt(e.target.value) || 2 })
              }
            />
            <span className="field-hint">Trades often keep it on page 2.</span>
          </label>
        )}

        <div
          className="sub-drop"
          onClick={() => backCoverInputRef.current?.click()}
        >
          {customBackCover ? `Custom: ${customBackCover.name}` : '+ Drop custom back cover image'}
        </div>
        <input
          type="file"
          ref={backCoverInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={(e) => {
            if (e.target.files?.[0]) onSetCustomBackCover(e.target.files[0]);
            e.target.value = '';
          }}
        />
        {customBackCover && (
          <button
            type="button"
            className="btn-ghost"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', alignSelf: 'flex-start' }}
            onClick={onClearCustomBackCover}
          >
            Clear custom back cover
          </button>
        )}
      </div>

      {/* Advert Pool */}
      <div className="panel">
        <h2>
          <ImageIcon size={16} /> Advert Pool ({advertPool.length})
        </h2>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Padding pages fill gaps so saddle-stitch folds correctly. Adverts are evenly balanced across the comic so the difference between max and min frequency is at most 1.
        </p>

        <div
          className="sub-drop"
          onClick={() => adInputRef.current?.click()}
        >
          + Drop or select advert images
        </div>
        <input
          type="file"
          ref={adInputRef}
          style={{ display: 'none' }}
          multiple
          accept="image/*"
          onChange={(e) => {
            if (e.target.files) onAddAdverts(Array.from(e.target.files));
            e.target.value = '';
          }}
        />

        {advertPool.length > 0 && (
          <div className="ads-grid">
            {advertPool.map((ad, idx) => {
              const count = advertUsageCounts ? advertUsageCounts[ad.name] ?? 0 : undefined;
              return (
                <div className="ad-tile" key={`${ad.name}-${idx}`}>
                  <img src={ad.objectUrl} alt={ad.name} />
                  {count !== undefined && (
                    <span
                      className="ad-tile-badge"
                      title={`${count} appearance${count === 1 ? '' : 's'} in current plan`}
                    >
                      {count}&times;
                    </span>
                  )}
                  <button
                    type="button"
                    className="ad-tile-remove"
                    onClick={() => onRemoveAdvert(idx)}
                    title={`Remove ${ad.name}`}
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <label className="field">
          <span className="field-label">Place an advert every</span>
          <div className="inline-input">
            <input
              type="number"
              min="0"
              value={options.fillerInterval}
              onChange={(e) =>
                onChange({ ...options, fillerInterval: parseInt(e.target.value) || 0 })
              }
            />
            <span className="unit">story pages</span>
          </div>
          <span className="field-hint">0 places ads only where binding needs filler pages.</span>
        </label>
      </div>

      {/* Binding Panel */}
      <div className="panel">
        <h2>
          <Layers size={16} /> Binding &amp; Output
        </h2>

        <label className="field">
          <span className="field-label">Pad page count to multiple of</span>
          <input
            type="number"
            min="0"
            max="64"
            value={options.padToMultiple}
            onChange={(e) =>
              onChange({ ...options, padToMultiple: parseInt(e.target.value) || 0 })
            }
          />
          <span className="field-hint">
            Use 4 for saddle-stitch booklets. 0 turns padding off.
          </span>
        </label>

        <details className="advanced">
          <summary>Image Quality</summary>
          <label className="field">
            <span className="field-label">JPEG quality for re-encoded pages</span>
            <input
              type="number"
              min="40"
              max="100"
              value={options.jpegQuality}
              onChange={(e) =>
                onChange({ ...options, jpegQuality: parseInt(e.target.value) || 95 })
              }
            />
            <span className="field-hint">
              Baseline JPEGs are embedded byte-for-byte with zero quality loss.
            </span>
          </label>
        </details>
      </div>
    </>
  );
}

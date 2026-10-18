import { useEffect, useState } from 'react';
import { Focus, Lock, Unlock, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { parseZoomPercent, zoomLimits, zoomPercent } from '@/lib/board-camera';

export function BoardZoom({
  zoom,
  locked,
  onZoom,
  onStep,
  onLock,
  onFit,
  expanded,
  onExpand,
}: {
  zoom: number;
  locked: boolean;
  onZoom: (zoom: number) => void;
  onStep: (direction: number) => void;
  onLock: (locked: boolean) => void;
  onFit: () => void;
  expanded: boolean;
  onExpand: () => void;
}) {
  const [draft, setDraft] = useState(zoomPercent(zoom)),
    [error, setError] = useState('');
  useEffect(() => {
    setDraft(zoomPercent(zoom));
    setError('');
  }, [zoom, locked]);
  const commit = () => {
    const next = parseZoomPercent(draft);
    if (next === null) {
      setError('Enter a number from 5 to 400.');
      setDraft(zoomPercent(zoom));
      return;
    }
    setError('');
    setDraft(zoomPercent(next));
    onZoom(next);
  };
  return (
    <div
      className="zoom"
      data-board-controls
      role="group"
      aria-label="Board zoom"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out 10%"
        disabled={locked || zoom <= zoomLimits.min}
        onClick={() => onStep(-1)}
      >
        <Minus size={16} />
      </button>
      <label className="zoom-value">
        <input
          aria-label="Zoom percentage"
          inputMode="decimal"
          value={draft}
          disabled={locked}
          aria-invalid={!!error}
          aria-describedby={error ? 'zoom-error' : undefined}
          title="Type a zoom from 5% to 400%"
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            setDraft(event.target.value);
            setError('');
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setDraft(zoomPercent(zoom));
              setError('');
            }
          }}
        />
        <span aria-hidden="true">%</span>
      </label>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in 10%"
        disabled={locked || zoom >= zoomLimits.max}
        onClick={() => onStep(1)}
      >
        <Plus size={16} />
      </button>
      <span className="divider" />
      <label
        className="zoom-lock"
        title={
          locked
            ? 'Zoom stays fixed across navigation and reopening. Panning is still available.'
            : 'Keep this zoom until you unlock it.'
        }
      >
        {locked ? <Lock size={13} /> : <Unlock size={13} />}
        <Switch aria-label="Lock zoom" size="sm" checked={locked} onCheckedChange={onLock} />
      </label>
      <button
        type="button"
        aria-label={locked ? 'Center board' : 'Fit board'}
        title={locked ? 'Center board at locked zoom (F)' : 'Fit all visible evidence (F)'}
        onClick={onFit}
      >
        <Focus size={17} />
      </button>
      <button
        type="button"
        aria-label={expanded ? 'Restore board view' : 'Expand board'}
        title={expanded ? 'Restore header and timeline (Esc)' : 'Expand board workspace'}
        aria-pressed={expanded}
        onClick={onExpand}
      >
        {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
      {error && (
        <small id="zoom-error" role="alert" className="zoom-error">
          {error}
        </small>
      )}
    </div>
  );
}

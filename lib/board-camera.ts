import type { CardBounds } from './board-placement.ts';

export type BoardCamera = { x: number; y: number; z: number };
export const zoomLimits = { min: 0.05, max: 4 };
export const zoomPreferenceKey = 'anacapa-board-zoom-v1';

export function boundedZoom(value: number) {
  return Number.isFinite(value) ? Math.min(zoomLimits.max, Math.max(zoomLimits.min, value)) : 1;
}

export function parseZoomPercent(value: string) {
  const text = value.trim().replace(/%$/, '').trim();
  return /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) && Number.isFinite(Number(text))
    ? boundedZoom(Number(text) / 100)
    : null;
}

export function zoomPercent(value: number) {
  return String(Math.round(value * 10000) / 100);
}

/** Keep the world point beneath the anchor still when changing scale. */
export function zoomAt(camera: BoardCamera, requested: number, anchor: { x: number; y: number }) {
  const z = boundedZoom(requested);
  return {
    z,
    x: anchor.x - ((anchor.x - camera.x) * z) / camera.z,
    y: anchor.y - ((anchor.y - camera.y) * z) / camera.z,
  };
}

export function readZoomPreference(raw: string | null) {
  try {
    const value = JSON.parse(raw || 'null');
    if (
      typeof value?.locked === 'boolean' &&
      typeof value?.zoom === 'number' &&
      Number.isFinite(value.zoom)
    )
      return { locked: value.locked, zoom: boundedZoom(value.zoom) };
  } catch {
    /* A corrupt device preference must not stop the app loading. */
  }
  return { locked: false, zoom: 1 };
}

/** Bounds are in board coordinates; margins reserve space for the floating controls. */
export function frameBoard(
  bounds: CardBounds[],
  viewport: { width: number; height: number },
  margins: { top: number; bottom: number; side: number },
  fixedZoom?: number,
): BoardCamera {
  const width = Math.max(1, viewport.width - margins.side * 2),
    height = Math.max(1, viewport.height - margins.top - margins.bottom);
  if (!bounds.length) return { x: margins.side, y: margins.top, z: fixedZoom ?? 1 };
  const left = Math.min(...bounds.map((b) => b.x)),
    top = Math.min(...bounds.map((b) => b.y)),
    right = Math.max(...bounds.map((b) => b.x + b.width)),
    bottom = Math.max(...bounds.map((b) => b.y + b.height));
  const z =
    fixedZoom === undefined
      ? Math.min(
          1.2,
          boundedZoom(
            Math.min(width / Math.max(1, right - left), height / Math.max(1, bottom - top)),
          ),
        )
      : boundedZoom(fixedZoom);
  return {
    z,
    x: margins.side + width / 2 - ((left + right) / 2) * z,
    y: margins.top + height / 2 - ((top + bottom) / 2) * z,
  };
}

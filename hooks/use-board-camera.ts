import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type SetStateAction,
} from 'react';
import type { Evidence } from '@/lib/case-data';
import { cardBounds } from '@/lib/board-placement';
import {
  boundedZoom,
  frameBoard,
  readZoomPreference,
  zoomAt,
  zoomPreferenceKey,
  type BoardCamera,
} from '@/lib/board-camera';
import type { BoardDrag } from './use-board-gestures';

/** Device-only viewing controls; never saved as evidence or included in case exports. */
export function useBoardCamera({
  boardRef,
  drag,
  nodes,
  viewKey,
  enabled,
  loaded,
}: {
  boardRef: RefObject<HTMLDivElement | null>;
  drag: RefObject<BoardDrag | null>;
  nodes: Evidence[];
  viewKey: string;
  enabled: boolean;
  loaded: boolean;
}) {
  const [preference, setPreference] = useState(() => {
    try {
      return readZoomPreference(localStorage.getItem(zoomPreferenceKey));
    } catch {
      return readZoomPreference(null);
    }
  });
  const [camera, updateCamera] = useState<BoardCamera>({
    x: 0,
    y: 0,
    z: preference.locked ? preference.zoom : 1,
  });
  const cameraRef = useRef(camera),
    preferenceRef = useRef(preference),
    nodesRef = useRef(nodes);
  const manual = useRef(0);
  cameraRef.current = camera;
  preferenceRef.current = preference;
  nodesRef.current = nodes;
  const setCamera = useCallback((action: SetStateAction<BoardCamera>) => {
    updateCamera((before) => {
      const next = typeof action === 'function' ? action(before) : action;
      cameraRef.current = next;
      return next;
    });
  }, []);
  const setZoom = useCallback(
    (value: number, anchor?: { x: number; y: number }) => {
      manual.current++;
      if (preferenceRef.current.locked || drag.current) return;
      const el = boardRef.current;
      setCamera((before) =>
        zoomAt(
          before,
          value,
          anchor ?? { x: (el?.clientWidth || 800) / 2, y: (el?.clientHeight || 400) / 2 },
        ),
      );
    },
    [boardRef, drag, setCamera],
  );
  const stepZoom = useCallback(
    (direction: number) => {
      manual.current++;
      if (preferenceRef.current.locked || drag.current) return;
      const el = boardRef.current;
      setCamera((before) =>
        zoomAt(before, Math.round((before.z + direction * 0.1) * 10000) / 10000, {
          x: (el?.clientWidth || 800) / 2,
          y: (el?.clientHeight || 400) / 2,
        }),
      );
    },
    [boardRef, drag, setCamera],
  );
  const setZoomLocked = useCallback((locked: boolean) => {
    manual.current++;
    const next = { locked, zoom: cameraRef.current.z };
    preferenceRef.current = next;
    setPreference(next);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(zoomPreferenceKey, JSON.stringify(preference));
    } catch {
      /* Session controls still work. */
    }
  }, [preference]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== zoomPreferenceKey && event.key !== null) return;
      manual.current++;
      const next = readZoomPreference(event.newValue);
      preferenceRef.current = next;
      setPreference(next);
      if (next.locked) {
        const el = boardRef.current;
        setCamera((before) =>
          zoomAt(before, next.zoom, {
            x: (el?.clientWidth || 800) / 2,
            y: (el?.clientHeight || 400) / 2,
          }),
        );
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [boardRef, setCamera]);
  const frame = useCallback(() => {
    const el = boardRef.current;
    if (!el || drag.current) return;
    const cards = new Map(
      Array.from(el.querySelectorAll<HTMLElement>('.evidence-card')).map((card) => [
        card.dataset.nodeId,
        card,
      ]),
    );
    const bounds = nodesRef.current.map((node) => {
      const card = cards.get(node.id);
      return cardBounds(
        node,
        card ? { width: card.offsetWidth, height: card.offsetHeight } : undefined,
      );
    });
    for (const label of el.querySelectorAll<HTMLElement>('.connection-label'))
      bounds.push({
        x: label.offsetLeft - label.offsetWidth / 2,
        y: label.offsetTop - label.offsetHeight / 2,
        width: label.offsetWidth,
        height: label.offsetHeight,
      });
    const top = el.querySelector<HTMLElement>('.branch-context')?.offsetHeight || 0;
    const toolbar = el.querySelector<HTMLElement>('.canvas-toolbar');
    const controls = el.querySelector<HTMLElement>('.zoom');
    const bottom = Math.max(
      toolbar ? el.clientHeight - toolbar.offsetTop : 0,
      controls ? el.clientHeight - controls.offsetTop : 0,
    );
    setCamera(
      frameBoard(
        bounds,
        { width: el.clientWidth, height: el.clientHeight },
        { top: top + 24, bottom: bottom + 18, side: 24 },
        preferenceRef.current.locked ? preferenceRef.current.zoom : undefined,
      ),
    );
  }, [boardRef, drag, setCamera]);
  const fit = useCallback(() => {
    manual.current++;
    frame();
  }, [frame]);
  useEffect(() => {
    if (!enabled || !loaded) return;
    let cancelled = false,
      raf = 0;
    const revision = manual.current;
    // Await font metrics, but never override an interaction made while waiting.
    void document.fonts.ready.then(() => {
      if (cancelled) return;
      raf = requestAnimationFrame(() => {
        if (!cancelled && revision === manual.current) frame();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [viewKey, enabled, loaded, frame]);
  useEffect(() => {
    const el = boardRef.current;
    if (!el || !enabled) return;
    let width = el.clientWidth,
      height = el.clientHeight;
    const observer = new ResizeObserver(() => {
      const dx = (el.clientWidth - width) / 2,
        dy = (el.clientHeight - height) / 2;
      width = el.clientWidth;
      height = el.clientHeight;
      if (dx || dy) setCamera((before) => ({ ...before, x: before.x + dx, y: before.y + dy }));
    });
    observer.observe(el);
    const wheel = (event: WheelEvent) => {
      if ((event.target as Element).closest('[data-board-controls],.branch-context')) {
        if (event.ctrlKey || event.metaKey) event.preventDefault();
        return;
      }
      event.preventDefault();
      manual.current++;
      if (drag.current) return;
      if (event.ctrlKey || event.metaKey) {
        if (preferenceRef.current.locked) return;
        const rect = el.getBoundingClientRect();
        setZoom(
          boundedZoom(
            cameraRef.current.z * Math.exp(Math.max(-4, Math.min(4, -event.deltaY * 0.008))),
          ),
          {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          },
        );
      } else {
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1;
        setCamera((before) => ({
          ...before,
          x: before.x - event.deltaX * unit,
          y: before.y - event.deltaY * unit,
        }));
      }
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      observer.disconnect();
      el.removeEventListener('wheel', wheel);
    };
  }, [enabled, boardRef, drag, setCamera, setZoom]);
  return {
    camera,
    cameraRef,
    setCamera,
    setZoom,
    stepZoom,
    fit,
    zoomLocked: preference.locked,
    setZoomLocked,
  };
}

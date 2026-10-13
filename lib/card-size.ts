import type { Evidence } from './case-data.ts';

export type CardSize = { width: number; height: number };
export const cardSizeLimits = { minWidth: 160, minHeight: 100, maxWidth: 720, maxHeight: 640 };

export function boundedCardSize(size: CardSize): CardSize {
  return {
    width: Math.max(cardSizeLimits.minWidth, Math.min(cardSizeLimits.maxWidth, size.width)),
    height: Math.max(cardSizeLimits.minHeight, Math.min(cardSizeLimits.maxHeight, size.height)),
  };
}

/** Same preview threshold in the editor and the portable viewer. */
export function compactCard(size: CardSize) {
  return size.width < 220 || size.height < 168;
}

/** Leave space for a title and controls before showing more lines of notes. */
export function cardPreviewLines(
  size: CardSize,
  title: string,
  hasField: boolean,
  hasImage: boolean,
) {
  const titleLines = Math.min(3, Math.max(1, Math.ceil(title.length / ((size.width - 36) / 9))));
  const reserved =
    106 +
    titleLines * 24 +
    (hasField && size.height >= 240 ? 34 : 0) +
    (hasImage && size.height >= 320 ? 132 : 0);
  return Math.max(1, Math.floor((size.height - reserved) / 21));
}

type ResizeStart = CardSize & { x: number; y: number; rotation: number };

/** Bound the rendered text as well as its visual height; the case retains the original. */
export function cardPreviewText(summary: string, width: number, lines: number) {
  const limit = Math.max(115, Math.ceil((width - 34) / 5) * lines);
  return summary.length > limit ? summary.slice(0, limit).trimEnd() + '…' : summary;
}

/** Keep the opposite corner fixed, including cards rotated around their centre. */
export function sizeCard(start: ResizeStart, requested: CardSize) {
  const boardSize = boundedCardSize(requested);
  const angle = (start.rotation * Math.PI) / 180,
    dx = (boardSize.width - start.width) / 2,
    dy = (boardSize.height - start.height) / 2;
  return {
    boardSize,
    x: Math.max(
      -100000,
      Math.min(100000, start.x + Math.cos(angle) * dx - Math.sin(angle) * dy - dx),
    ),
    y: Math.max(
      -100000,
      Math.min(100000, start.y + Math.sin(angle) * dx + Math.cos(angle) * dy - dy),
    ),
  };
}

/** Screen movement is converted to the card's axes, rather than multiplied by board zoom. */
export function dragCardSize(start: ResizeStart, dx: number, dy: number, zoom: number) {
  const angle = (start.rotation * Math.PI) / 180;
  return sizeCard(start, {
    width: start.width + (dx * Math.cos(angle) + dy * Math.sin(angle)) / zoom,
    height: start.height + (-dx * Math.sin(angle) + dy * Math.cos(angle)) / zoom,
  });
}

/** Preserve the old connection positions until a card is explicitly resized. */
export function cardAnchor(node: Pick<Evidence, 'x' | 'y' | 'boardSize'>) {
  return {
    x: node.x + (node.boardSize ? node.boardSize.width / 2 : 118),
    y: node.y + (node.boardSize ? node.boardSize.height / 2 : 82),
  };
}

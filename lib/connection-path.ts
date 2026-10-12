export const wireStyles = ['curved', 'straight', 'elbow', 'spring', 'wave', 'zigzag'] as const;
export type WireStyle = (typeof wireStyles)[number];
export const wireStyleNames: Record<WireStyle, string> = {
  curved: 'Curved',
  straight: 'Straight',
  elbow: 'Elbow',
  spring: 'Spring',
  wave: 'Wave',
  zigzag: 'Zigzag',
};

/** Pure geometry, also embedded in the self-contained HTML viewer. */
export function wirePath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  style: WireStyle = 'curved',
) {
  const start = `M${sx} ${sy}`,
    end = `L${tx} ${ty}`;
  const dx = tx - sx,
    dy = ty - sy,
    length = Math.hypot(dx, dy);
  if (style === 'straight') return start + end;
  if (style === 'elbow') {
    if (Math.abs(dx) < 1 || Math.abs(dy) < 1) return start + end;
    const points =
      Math.abs(dx) >= Math.abs(dy)
        ? [
            [sx, sy],
            [(sx + tx) / 2, sy],
            [(sx + tx) / 2, ty],
            [tx, ty],
          ]
        : [
            [sx, sy],
            [sx, (sy + ty) / 2],
            [tx, (sy + ty) / 2],
            [tx, ty],
          ];
    let path = start;
    for (let i = 1; i < points.length - 1; i++) {
      const [x, y] = points[i],
        [px, py] = points[i - 1],
        [nx, ny] = points[i + 1];
      const before = Math.hypot(px - x, py - y),
        after = Math.hypot(nx - x, ny - y),
        r = Math.min(12, before / 2, after / 2);
      path += `L${x + ((px - x) * r) / before} ${y + ((py - y) * r) / before}Q${x} ${y} ${x + ((nx - x) * r) / after} ${y + ((ny - y) * r) / after}`;
    }
    return path + end;
  }
  if (style !== 'spring' && style !== 'wave' && style !== 'zigzag') {
    const x = (sx + tx) / 2;
    return `${start} C${x} ${sy},${x} ${ty},${tx} ${ty}`;
  }
  // Tiny links stay tidy. The cycle limit bounds work even for distant cards.
  if (length < 24) return start + end;
  const ux = dx / length,
    uy = dy / length,
    lead = Math.min(18, length * 0.15),
    active = length - 2 * lead;
  const amplitude = Math.min(style === 'wave' ? 6 : 7, length / 16);
  const point = (along: number, across: number) =>
    `${Number((sx + ux * along - uy * across).toFixed(2))} ${Number((sy + uy * along + ux * across).toFixed(2))}`;
  let path = start + 'L' + point(lead, 0);
  if (style === 'spring') {
    const turns = Math.max(1, Math.min(24, Math.round(active / 26))),
      segments = turns * 4,
      step = 1 / segments;
    // A projected helix: round coils rather than a second sine-wave option.
    for (let i = 1; i <= segments; i++) {
      const a = (i - 1) * step,
        b = i * step,
        pa = a * turns * 2 * Math.PI,
        pb = b * turns * 2 * Math.PI;
      const ax = lead + active * a + amplitude * (Math.cos(pa) - 1),
        ay = amplitude * Math.sin(pa);
      const bx = lead + active * b + amplitude * (Math.cos(pb) - 1),
        by = amplitude * Math.sin(pb);
      const dax = ((active - amplitude * turns * 2 * Math.PI * Math.sin(pa)) * step) / 3,
        day = (amplitude * turns * 2 * Math.PI * Math.cos(pa) * step) / 3;
      const dbx = ((active - amplitude * turns * 2 * Math.PI * Math.sin(pb)) * step) / 3,
        dby = (amplitude * turns * 2 * Math.PI * Math.cos(pb) * step) / 3;
      path +=
        'C' + point(ax + dax, ay + day) + ' ' + point(bx - dbx, by - dby) + ' ' + point(bx, by);
    }
  } else if (style === 'wave') {
    const waves = Math.max(1, Math.min(24, Math.round(active / 32))),
      step = active / (waves * 2);
    for (let i = 0; i < waves * 2; i++)
      path +=
        'Q' +
        point(lead + (i + 0.5) * step, (i % 2 ? -1 : 1) * amplitude * 2) +
        ' ' +
        point(lead + (i + 1) * step, 0);
  } else {
    const peaks = Math.max(2, Math.min(48, Math.round(active / 24) * 2));
    for (let i = 1; i <= peaks; i++)
      path += 'L' + point(lead + (active * i) / (peaks + 1), (i % 2 ? 1 : -1) * amplitude);
    path += 'L' + point(length - lead, 0);
  }
  return path + end;
}

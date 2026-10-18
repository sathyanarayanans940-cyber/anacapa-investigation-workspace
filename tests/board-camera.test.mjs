import test from 'node:test';
import assert from 'node:assert/strict';
import {
  boundedZoom,
  zoomAt,
  parseZoomPercent,
  readZoomPreference,
  frameBoard,
} from '../lib/board-camera.ts';

test('typed zoom accepts percentages, bounds extreme values, and rejects invalid input', () => {
  assert.equal(parseZoomPercent('73.5%'), 0.735);
  assert.equal(parseZoomPercent(' 125 % '), 1.25);
  assert.equal(parseZoomPercent('0'), 0.05);
  assert.equal(parseZoomPercent('9999'), 4);
  for (const value of ['', 'abc', '-20', '1e999', '100%%', '10.2.3', 'Infinity'])
    assert.equal(parseZoomPercent(value), null, value);
  assert.equal(boundedZoom(NaN), 1);
  assert.equal(boundedZoom(Infinity), 1);
});

test('zoom keeps the same board point beneath the anchor at every supported scale', () => {
  const camera = { x: -420, y: 37, z: 0.54 },
    anchor = { x: 613, y: 287 };
  for (const scale of [0.05, 0.73, 1, 4]) {
    const next = zoomAt(camera, scale, anchor);
    assert.ok(Math.abs((anchor.x - next.x) / next.z - (anchor.x - camera.x) / camera.z) < 1e-8);
    assert.ok(Math.abs((anchor.y - next.y) / next.z - (anchor.y - camera.y) / camera.z) < 1e-8);
  }
});

test('zoom preferences reject corrupt data and retain a locked fractional scale', () => {
  for (const value of [null, '{}', 'null', 'broken', '{"locked":true,"zoom":"2"}'])
    assert.deepEqual(readZoomPreference(value), { locked: false, zoom: 1 });
  assert.deepEqual(readZoomPreference('{"locked":true,"zoom":0.735}'), {
    locked: true,
    zoom: 0.735,
  });
  assert.deepEqual(readZoomPreference('{"locked":true,"zoom":100}'), { locked: true, zoom: 4 });
});

test('fit centres offset/negative bounds within the usable viewport and locked fit only recentres', () => {
  const bounds = [
    { x: -700, y: -200, width: 248, height: 250 },
    { x: 900, y: 800, width: 400, height: 310 },
  ];
  const viewport = { width: 1200, height: 800 },
    margins = { side: 24, top: 125, bottom: 90 };
  const camera = frameBoard(bounds, viewport, margins);
  for (const b of bounds) {
    assert.ok(b.x * camera.z + camera.x >= margins.side - 1e-6);
    assert.ok(b.y * camera.z + camera.y >= margins.top - 1e-6);
    assert.ok((b.x + b.width) * camera.z + camera.x <= viewport.width - margins.side + 1e-6);
    assert.ok((b.y + b.height) * camera.z + camera.y <= viewport.height - margins.bottom + 1e-6);
  }
  assert.equal(frameBoard(bounds, viewport, margins, 1.25).z, 1.25);
  assert.equal(frameBoard([], viewport, margins, 1.25).z, 1.25);
  assert.equal(frameBoard([{ x: 0, y: 0, width: 100, height: 100 }], viewport, margins).z, 1.2);
});

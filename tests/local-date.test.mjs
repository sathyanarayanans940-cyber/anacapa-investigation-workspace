import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTypedDate,
  datePart,
  isStoredDate,
  validDateRange,
  editorDate,
  editedDate,
  timestamp,
  wallDateLabel,
  timeLabel,
} from '../lib/local-date.ts';
import { workspaceSchema } from '../lib/validation.ts';
import { sample } from '../lib/case-data.ts';
test('typed dates accept local dates and 24-hour times without rolling invalid dates forward', () => {
  assert.equal(parseTypedDate('2026-10-10 15:12'), '2026-10-10T15:12');
  assert.equal(parseTypedDate('2024-02-29'), '2024-02-29T00:00');
  assert.equal(parseTypedDate(''), '');
  for (const v of ['2026-02-30', '2025-02-29', '2026-10-10 24:00', '10/10/26', '2026-10-10 12:75'])
    assert.equal(parseTypedDate(v), null);
  assert.equal(datePart(new Date(2026, 9, 10)), '2026-10-10');
});
test('custom evidence labels survive validation and portable storage without changing the base type', () => {
  const w = structuredClone(sample);
  w.cases[0].nodes[0].customKind = 'Witness interview';
  const parsed = workspaceSchema.parse(w);
  assert.equal(parsed.cases[0].nodes[0].kind, 'Event');
  assert.equal(parsed.cases[0].nodes[0].customKind, 'Witness interview');
  w.cases[0].nodes[0].customKind = ' ';
  assert.equal(workspaceSchema.safeParse(w).success, false);
});

test('stored dates reject calendar overflow and compare ranges as instants', () => {
  for (const value of [
    '2026-02-30T12:00',
    '2025-02-29T00:00Z',
    '2026-10-11T24:00',
    '2026-10-11T11:70',
    '2026-10-11T11:00:61Z',
    '2026-10-11T11:00+14:01',
  ])
    assert.equal(isStoredDate(value), false, value);
  for (const value of [
    '',
    '2024-02-29',
    '2026-10-11T11:00',
    '2026-10-11T11:00:30.123Z',
    '2026-10-11T11:00+05:30',
  ])
    assert.equal(isStoredDate(value), true, value);
  assert.equal(validDateRange('2026-10-11T10:00Z', '2026-10-11T12:00+05:30'), false);
  assert.equal(validDateRange('2026-10-11T12:00+05:30', '2026-10-11T10:00Z'), true);
  assert.equal(validDateRange('2026-10-11T10:00Z', '2026-10-11T12:00', '+05:30'), false);
  assert.equal(validDateRange('2026-10-11T10:00', '2026-10-11T05:00Z', '+05:30'), true);
  const w = structuredClone(sample);
  w.cases[0].nodes[0].date = '2026-02-30T12:00';
  assert.equal(workspaceSchema.safeParse(w).success, false);
});
test('date-only events and explicit source zones retain valid instants and consistent labels', () => {
  assert.equal(timestamp('2026-10-11', '+05:30'), '2026-10-11T00:00+05:30');
  assert.equal(Date.parse(timestamp('2026-10-11', '+05:30')), Date.parse('2026-10-10T18:30Z'));
  assert.equal(timestamp('2026-10-11T00:10Z', '+05:30'), '2026-10-11T00:10Z');
  assert.equal(wallDateLabel('2026-10-11T00:10+14:00'), 'Oct 11');
  assert.equal(timeLabel({ date: '2026-10-11T00:10Z', utcOffset: '+05:30' }), '00:10 UTC+00:00');
  assert.equal(timeLabel({ date: '2026-10-11', utcOffset: '+05:30' }), '');
  assert.equal(
    timeLabel({ date: '2026-10-11T00:10', utcOffset: '+05:30', timePrecision: 'date-only' }),
    '',
  );
});

test('editing imported timestamps preserves their explicit time zone and untouched seconds', () => {
  const stored = '2026-10-11T10:30:45.123Z';
  assert.equal(editorDate(stored), '2026-10-11 10:30');
  assert.equal(editedDate(stored, '2026-10-11T10:30'), stored);
  assert.equal(editedDate(stored, '2026-10-11T11:00'), '2026-10-11T11:00Z');
  assert.equal(editedDate('2026-10-11T10:30+05:30', '2026-10-12T10:30'), '2026-10-12T10:30+05:30');
  assert.equal(editedDate(stored, ''), '');
});

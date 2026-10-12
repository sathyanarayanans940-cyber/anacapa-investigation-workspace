import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { sample } from '../lib/case-data.ts';
import { packInvestigation, restoreInvestigation } from '../lib/investigation-package.ts';
import { createInvestigationViewer } from '../lib/investigation-viewer.ts';
import { createInvestigationViewer as bundledViewer } from '../runtime/model.mjs';
import { wirePath, wireStyles } from '../lib/connection-path.ts';

// Execute the exported viewer, observing the DOM it creates rather than its source text.
// Geometry is only needed to let the initial fit operation complete.
function viewerDocument(bundle) {
  class Element {
    children = [];
    style = {};
    dataset = {};
    attributes = {};
    className = '';
    textContent = '';
    clientWidth = 1400;
    clientHeight = 900;
    namespaceURI = 'http://www.w3.org/2000/svg';
    classList = { contains: (name) => this.className.split(' ').includes(name), toggle: () => {} };
    append(...elements) {
      this.children.push(...elements);
    }
    replaceChildren(...elements) {
      this.children = elements;
    }
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }
    get offsetWidth() {
      return this.className === 'label' ? 120 : 248;
    }
    get offsetHeight() {
      return this.className === 'label' ? 24 : 180;
    }
    get offsetLeft() {
      return Number.parseFloat(this.style.left) || 0;
    }
    get offsetTop() {
      return Number.parseFloat(this.style.top) || 0;
    }
    querySelectorAll(selector) {
      return this.children.filter((e) =>
        selector.split(',').some((s) => s.startsWith('.') && e.classList.contains(s.slice(1))),
      );
    }
    close() {}
  }
  const elements = new Map();
  const get = (name) => {
    if (!elements.has(name)) elements.set(name, new Element());
    return elements.get(name);
  };
  get('investigation-data').textContent = JSON.stringify(bundle);
  const views = ['board', 'timeline', 'report'].map((view) => {
    const e = new Element();
    e.dataset.view = view;
    return e;
  });
  return {
    documentElement: new Element(),
    getElementById: get,
    querySelector: get,
    querySelectorAll: () => views,
    createElement: () => new Element(),
    createElementNS: () => new Element(),
  };
}

test('saved, shared and restored connection colours are rendered unchanged in the HTML board', async () => {
  const file = structuredClone(sample.cases[0]);
  // A legacy colour and an arbitrary custom colour must both remain exact.
  file.threads[0].color = '#568cc7';
  file.threads[1].color = '#274b93';
  file.threads[1].dashed = true;
  const bundle = await packInvestigation(file, async () => {
    throw Error('No attachments expected');
  });
  const restored = restoreInvestigation(bundle, 'recipient', new Map());
  assert.deepEqual(restored.threads, file.threads);
  const html = createInvestigationViewer(bundle),
    script = html.match(/<script>(.*?)<\/script>/s)[1];
  const document = viewerDocument(bundle);
  await new Script(script).runInNewContext({
    document,
    window: {
      matchMedia: () => ({ matches: false, addEventListener() {} }),
      addEventListener() {},
    },
    URL,
    Blob,
    Uint8Array,
    atob,
  });
  const scene = document.getElementById('scene');
  const rootIds = new Set(file.nodes.filter((n) => n.parentId === null).map((n) => n.id));
  const visible = file.threads.filter((t) => rootIds.has(t.source) && rootIds.has(t.target));
  const paths = scene.children[0].children;
  const labels = scene.children.filter((e) => e.className === 'label');
  assert.deepEqual(
    paths.map((p) => p.attributes.stroke),
    visible.map((t) => t.color),
  );
  assert.deepEqual(
    labels.map((l) => l.style.color),
    visible.map((t) => t.color),
  );
  assert.equal(paths[1].attributes['stroke-dasharray'], '6 6');
  assert.equal(paths[0].attributes['stroke-dasharray'], undefined);
  assert.deepEqual(
    labels.map((l) => l.textContent),
    visible.map((t) => t.label),
  );
});

for (const [name, viewer] of [
  ['source', createInvestigationViewer],
  ['release', bundledViewer],
])
  test(`${name} HTML keeps every wire style, uncertainty marker and colour after sharing`, async () => {
    const file = structuredClone(sample.cases[0]);
    file.threads = wireStyles.map((style, i) => ({
      id: 'shape-' + i,
      source: 'morgan',
      target: 'delivery',
      style,
      label: style + ' relationship',
      color: i % 2 ? '#274b93' : '#bf7370',
      dashed: i % 2 === 1,
      labelOffset: { x: 12, y: -8 },
    }));
    const bundle = await packInvestigation(file, async () => {
      throw Error('No attachments expected');
    });
    assert.deepEqual(restoreInvestigation(bundle, 'recipient', new Map()).threads, file.threads);
    const script = viewer(bundle).match(/<script>(.*?)<\/script>/s)[1],
      document = viewerDocument(bundle);
    await new Script(script).runInNewContext({
      document,
      window: {
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        addEventListener() {},
      },
      URL,
      Blob,
      Uint8Array,
      atob,
    });
    const scene = document.getElementById('scene'),
      paths = scene.children[0].children;
    const a = file.nodes.find((n) => n.id === 'morgan'),
      b = file.nodes.find((n) => n.id === 'delivery');
    assert.equal(paths.length, 6);
    for (const [i, path] of paths.entries()) {
      const thread = file.threads[i];
      assert.equal(
        path.attributes.d,
        wirePath(a.x + 118, a.y + 82, b.x + 118, b.y + 82, thread.style),
      );
      assert.equal(path.attributes.stroke, thread.color);
      assert.equal(path.attributes['stroke-dasharray'], thread.dashed ? '6 6' : undefined);
    }
  });

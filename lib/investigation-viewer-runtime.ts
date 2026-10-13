import { wirePath } from './connection-path.ts';
import { cardAnchor, compactCard, cardPreviewLines, cardPreviewText } from './card-size.ts';
import { cardTypeTone } from './card-type-tone.ts';

export const script = String.raw`
(async function () {
  'use strict';
  const wirePath = ${wirePath.toString()};
  const cardAnchor = ${cardAnchor.toString()};
  const compactCard = ${compactCard.toString()};
  const cardPreviewLines = ${cardPreviewLines.toString()};
  const cardPreviewText = ${cardPreviewText.toString()};
  const cardTypeTone = ${cardTypeTone.toString()};
  document.documentElement.classList.toggle(
    'dark',
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  let bundle = JSON.parse(document.getElementById('investigation-data').textContent);
  if (bundle.format === 'anacapa-encrypted') {
    if (
      bundle.version !== 1 ||
      bundle.kdf !== 'PBKDF2-SHA256' ||
      bundle.iterations !== 600000 ||
      bundle.algorithm !== 'AES-256-GCM'
    ) {
      document.body.textContent = 'Unsupported protected investigation.';
      return;
    }
    const gate = document.createElement('div');
    gate.className = 'unlock-overlay';
    const form = document.createElement('form'),
      heading = document.createElement('h1'),
      description = document.createElement('p'),
      input = document.createElement('input'),
      submit = document.createElement('button'),
      error = document.createElement('p');
    heading.textContent = 'Protected investigation';
    description.textContent =
      'Enter the sharing passphrase to view this copy. Everything is unlocked locally in your browser.';
    input.type = 'password';
    input.required = true;
    input.autocomplete = 'current-password';
    input.placeholder = 'Sharing passphrase';
    input.setAttribute('aria-label', 'Sharing passphrase');
    submit.textContent = 'Unlock investigation';
    error.setAttribute('role', 'alert');
    form.append(heading, description, input, submit, error);
    gate.append(form);
    document.body.append(gate);
    input.focus();
    bundle = await new Promise((resolve) => {
      form.onsubmit = async (e) => {
        e.preventDefault();
        submit.disabled = true;
        error.textContent = '';
        try {
          if (!crypto.subtle) throw Error();
          const bytes = (value) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
          const salt = bytes(bundle.salt),
            iv = bytes(bundle.iv);
          if (salt.length !== 32 || iv.length !== 12) throw Error();
          const material = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(input.value),
            'PBKDF2',
            false,
            ['deriveKey'],
          );
          const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: 600000, hash: 'SHA-256' },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt'],
          );
          const plain = await crypto.subtle.decrypt(
            {
              name: 'AES-GCM',
              iv,
              additionalData: new TextEncoder().encode('anacapa-portable-v1'),
              tagLength: 128,
            },
            key,
            bytes(bundle.data),
          );
          const decoded = JSON.parse(new TextDecoder().decode(plain));
          if (decoded.format !== 'anacapa-investigation') throw Error();
          input.value = '';
          gate.remove();
          resolve(decoded);
        } catch {
          error.textContent =
            'Wrong passphrase or a damaged file. Use a current browser that supports local cryptography.';
        } finally {
          submit.disabled = false;
        }
      };
    });
  }
  const file = bundle.investigation,
    nodes = file.nodes;
  const board = document.getElementById('board'),
    scene = document.getElementById('scene'),
    timeline = document.getElementById('timeline'),
    nav = document.querySelector('nav'),
    drawer = document.querySelector('dialog'),
    report = document.getElementById('report');
  const urls = new Map();
  bundle.assets.forEach((a) => {
    const bytes = Uint8Array.from(atob(a.data), (c) => c.charCodeAt(0));
    urls.set(
      a.url,
      URL.createObjectURL(new Blob([bytes], { type: a.type || 'application/octet-stream' })),
    );
  });
  window.addEventListener('unload', () => urls.forEach((url) => URL.revokeObjectURL(url)));
  let scope = null,
    mode = 'board',
    camera = { x: 0, y: 0, z: 1 },
    gesture = null;
  const expanded = new Set();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const find = (id) => byId.get(id),
    headline = (n) =>
      n.titleField === 'title'
        ? n.title
        : n.fields.find((f) => f.id === n.titleField)?.value || n.title;
  const branchPath = (id) => {
    const path = [];
    let n = find(id);
    while (n) {
      path.unshift(headline(n));
      n = find(n.parentId);
    }
    return ['Case timeline', ...path].join(' / ');
  };
  const instant = (n) =>
    n.date
      ? Date.parse(
          (n.date.length === 10 ? n.date + 'T00:00' : n.date) +
            (n.utcOffset && !/(Z|[+-]\d\d:\d\d)$/.test(n.date) ? n.utcOffset : ''),
        )
      : Infinity;
  const children = (id) =>
    nodes
      .filter((n) => n.parentId === id)
      .sort((a, b) => instant(a) - instant(b) || a.title.localeCompare(b.title));
  const dated = (n) =>
    n.date
      ? (n.timePrecision === 'approximate' ? '≈ ' : '') +
        (n.timePrecision === 'date-only' || n.date.length === 10
          ? n.date.slice(0, 10)
          : n.date.replace('T', ' ') +
            (/(?:Z|[+-]\d\d:\d\d)$/.test(n.date)
              ? ''
              : n.utcOffset
                ? ' UTC' + n.utcOffset
                : ' · local time'))
      : 'Undated';
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const button = (text, action, className) => {
    const b = el('button', className, text);
    b.type = 'button';
    b.onclick = action;
    return b;
  };
  const imageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  document.getElementById('case-title').textContent = file.title;
  document.title = file.title + ' · Anacapa';
  document.getElementById('export-date').textContent =
    'Shared copy · ' + new Date(bundle.exportedAt).toLocaleDateString();
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  document.documentElement.classList.toggle('dark', dark.matches);
  dark.addEventListener('change', (e) =>
    document.documentElement.classList.toggle('dark', e.matches),
  );
  document.getElementById('theme').onclick = () =>
    document.documentElement.classList.toggle('dark');
  function navTo(id) {
    scope = id;
    drawer.close();
    render();
    fit();
  }
  function card(n, onBoard = false) {
    const b = el('button', 'card');
    const tone = cardTypeTone(n);
    b.dataset.type = tone.type;
    if (tone.type === 'custom') {
      b.style.setProperty('--card-custom-hue', tone.hue);
      b.style.setProperty('--card-custom-saturation', tone.saturation + '%');
      b.style.setProperty('--card-custom-lift', tone.lift + '%');
    }
    const pic = n.images.find((a) => imageTypes.includes(a.type));
    const compact = onBoard && n.boardSize && compactCard(n.boardSize);
    const lines = onBoard && n.boardSize ? cardPreviewLines(n.boardSize, headline(n), n.fields.length > 0, !!pic) : 0;
    if (onBoard && n.boardSize) {
      b.classList.add('sized-card');
      b.classList.toggle('compact-card', compactCard(n.boardSize));
      b.style.width = n.boardSize.width + 'px';
      b.style.height = n.boardSize.height + 'px';
      b.style.setProperty('--preview-lines', lines);
    }
    b.type = 'button';
    b.dataset.nodeId = n.id;
    b.dataset.confidence = n.confidence.toLowerCase();
    b.dataset.priority = String(n.pinned);
    b.setAttribute('aria-label', 'View ' + headline(n));
    b.setAttribute('aria-description', n.confidence + ' confidence.' + (n.pinned ? ' Priority card.' : ''));
    b.title = n.confidence + (n.pinned ? ' · Priority' : '');
    b.onclick = () => open(n);
    const kind = el('span', 'kind', n.customKind || n.kind);
    if (n.pinned) kind.append(el('span', 'card-priority', 'Priority'));
    b.append(
      el('i', 'pin'),
      kind,
      el('h2', '', headline(n)),
      el('p', '', compact ? '' : onBoard && n.boardSize ? cardPreviewText(n.summary, n.boardSize.width, lines) : n.summary.slice(0, 160)),
    );
    if (n.fields[0] && (!onBoard || !n.boardSize || n.boardSize.height >= 240)) b.append(el('span', 'detail', n.fields[0].value));
    if (!compact && pic && (!onBoard || !n.boardSize || n.boardSize.height >= 320)) {
      const img = el('img', 'preview');
      img.src = urls.get(pic.url);
      img.alt = pic.name;
      img.draggable = false;
      b.append(img);
    }
    const confidence = el('span', 'card-confidence');
    confidence.append(el('i', 'card-status-mark'), el('span', '', n.confidence));
    b.append(confidence);
    return b;
  }
  function render() {
    nav.replaceChildren(button('All evidence', () => navTo(null)));
    const ancestors = [];
    let n = find(scope);
    while (n) {
      ancestors.unshift(n);
      n = find(n.parentId);
    }
    ancestors.forEach((n) =>
      nav.append(
        el('span', '', '›'),
        button(headline(n), () => navTo(n.id)),
      ),
    );
    board.style.display = mode === 'board' ? 'block' : 'none';
    timeline.style.display = mode === 'timeline' ? 'block' : 'none';
    document.querySelector('.controls').style.display = mode === 'board' ? 'flex' : 'none';
    document
      .querySelectorAll('[data-view]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === mode)));
    report.style.display = mode === 'report' ? 'block' : 'none';
    if (mode === 'report') {
      renderReport();
      return;
    }
    if (mode === 'timeline') {
      renderTimeline();
      return;
    }
    scene.replaceChildren();
    const visible = children(scope),
      ids = new Set(visible.map((n) => n.id));
    if (!visible.length) {
      scene.append(el('div', 'empty', 'No evidence in this branch.'));
      return;
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '1');
    svg.setAttribute('height', '1');
    scene.append(svg);
    const threads = file.threads.filter((t) => ids.has(t.source) && ids.has(t.target));
    threads.forEach((t) => {
      const a = find(t.source),
        b = find(t.target),
        {x: sx, y: sy} = cardAnchor(a),
        {x: tx, y: ty} = cardAnchor(b),
        path = document.createElementNS(svg.namespaceURI, 'path');
      path.setAttribute('d', wirePath(sx, sy, tx, ty, t.style));
      path.setAttribute('stroke', t.color);
      path.setAttribute('stroke-width', '1.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('fill', 'none');
      if (t.dashed) path.setAttribute('stroke-dasharray', '6 6');
      svg.append(path);
    });
    visible.forEach((n) => {
      const b = card(n, true);
      b.style.left = n.x + 'px';
      b.style.top = n.y + 'px';
      b.style.transform = 'rotate(' + (n.rotation ?? (n.kind === 'Note' ? -2 : 0)) + 'deg)';
      scene.append(b);
    });
    threads.forEach((t) => {
      const a = find(t.source),
        b = find(t.target),
        label = el('span', 'label', t.label);
      const source = cardAnchor(a), target = cardAnchor(b);
      label.style.color = t.color;
      label.style.left = (source.x + target.x) / 2 + (t.labelOffset?.x || 0) + 'px';
      label.style.top = (source.y + target.y) / 2 + (t.labelOffset?.y || 0) + 'px';
      scene.append(label);
    });
    transform();
  }
  function renderReport() {
    report.replaceChildren(
      el('h1', '', file.title),
      el('p', '', file.description),
      el('small', '', 'Snapshot exported ' + new Date(bundle.exportedAt).toLocaleString()),
      button('Print / save as PDF', () => window.print(), 'print-report'),
    );
    const events = [...nodes].sort(
      (a, b) => instant(a) - instant(b) || a.title.localeCompare(b.title),
    );
    for (const n of events) {
      const section = el('section', 'report-event');
      section.append(
        el('small', '', branchPath(n.parentId)),
        el('h2', '', headline(n)),
        field('Type / status', (n.customKind || n.kind) + ' · ' + n.confidence),
        field('Time', dated(n)),
        el('p', '', n.summary),
      );
      if (n.endDate) section.append(field('Until', dated({ ...n, date: n.endDate })));
      if (n.originalTimestamp) section.append(field('Source time', n.originalTimestamp));
      n.fields.forEach((f) => section.append(field(f.label, f.value)));
      if (n.tags.length) section.append(field('Tags', n.tags.join(' · ')));
      (n.citations || []).forEach((c) =>
        section.append(
          field(
            'Source',
            [
              c.source,
              c.reference,
              c.locator,
              c.claim,
              c.collectedBy,
              c.collectedAt,
              c.method,
              c.url,
            ]
              .filter(Boolean)
              .join(' · '),
          ),
        ),
      );
      for (const im of n.images) {
        const link = el('a', '', im.name);
        link.href = urls.get(im.url);
        link.download = im.name;
        section.append(link);
        if (im.sha256) section.append(field('SHA-256', im.sha256));
      }
      const links = file.threads.filter((t) => t.source === n.id || t.target === n.id);
      for (const t of links) {
        section.append(
          field(
            'Relationship',
            headline(find(t.source)) +
              ' → ' +
              t.label +
              (t.dashed ? ' (uncertain)' : '') +
              ' → ' +
              headline(find(t.target)),
          ),
        );
        (t.citations || []).forEach((c) =>
          section.append(
            field(
              'Link source',
              [c.source, c.reference, c.locator, c.claim].filter(Boolean).join(' · '),
            ),
          ),
        );
      }
      report.append(section);
    }
    if (bundle.integrity)
      report.append(
        field(
          'Case checkpoint',
          'Revision ' + bundle.integrity.sequence + ' · ' + bundle.integrity.auditHash,
        ),
        el(
          'p',
          '',
          bundle.integrity.note ||
            'Checkpoint recorded at export. It is not a certification of the evidence.',
        ),
      );
    if (bundle.custody?.length) {
      report.append(el('h2', '', 'Custody records'));
      for (const event of bundle.custody)
        report.append(
          field(
            event.when,
            event.from +
              ' → ' +
              event.to +
              ' · ' +
              event.method +
              ' · ' +
              event.note +
              ' · Recorded by ' +
              event.recordedBy,
          ),
        );
    }
  }
  function renderTimeline() {
    timeline.replaceChildren(lane(scope));
  }
  function lane(id) {
    const items = children(id),
      branches = items.filter((n) => expanded.has(n.id) && children(n.id).length),
      section = el('section', 'lane' + (branches.length ? ' compact-parent' : '')),
      heading = el('div', 'lane-heading');
    heading.append(el('span', '', id ? 'Inside ' + headline(find(id)) : 'Case timeline'));
    if (branches.length)
      heading.append(
        button('Expand parent timeline', () => {
          branches.forEach((n) => expanded.delete(n.id));
          renderTimeline();
        }),
      );
    section.append(heading);
    const track = el('div', 'lane-track');
    items.forEach((n, index) => {
      const side = n.timelineSide || (index % 2 === 0 ? 'above' : 'below'),
        style =
          n.timelineStyle ||
          (n.kind === 'Note'
            ? 'note'
            : n.kind === 'Person' || n.kind === 'Location'
              ? 'compact'
              : 'card');
      const event = el('article', 'event ' + side + ' event-style-' + style),
        time = el('time', '', dated(n)),
        axis = el('div', 'event-axis'),
        body = el('div', 'event-body');
      if (n.date) time.dateTime = n.date;
      axis.append(
        time,
        el('div', 'event-line'),
        button(
          headline(n),
          () => {
            if (children(n.id).length) {
              expanded.has(n.id) ? expanded.delete(n.id) : expanded.add(n.id);
              renderTimeline();
            } else open(n);
          },
          'context-event',
        ),
      );
      const item = card(n);
      body.dataset.confidence = n.confidence.toLowerCase();
      body.dataset.priority = String(n.pinned);
      body.dataset.type = item.dataset.type;
      if (item.dataset.type === 'custom') {
        const tone = cardTypeTone(n);
        body.style.setProperty('--card-custom-hue', tone.hue);
        body.style.setProperty('--card-custom-saturation', tone.saturation + '%');
        body.style.setProperty('--card-custom-lift', tone.lift + '%');
      }
      if (style !== 'card') item.querySelector('.preview')?.remove();
      body.append(item);
      event.append(axis, body);
      const actions = el('div', 'event-actions');
      if (children(n.id).length)
        actions.append(
          button((expanded.has(n.id) ? '⌄ ' : '› ') + children(n.id).length + ' sub-events', () => {
            expanded.has(n.id) ? expanded.delete(n.id) : expanded.add(n.id);
            renderTimeline();
          }),
        );
      actions.append(
        button('Evidence', () => {
          mode = 'board';
          navTo(n.id);
        }),
      );
      body.append(actions);
      track.append(event);
    });
    section.append(track);
    if (!items.length) section.append(el('div', 'empty', 'No evidence in this branch.'));
    items
      .filter((n) => expanded.has(n.id) && children(n.id).length)
      .forEach((n) => {
        const nested = el('div', 'nested');
        nested.append(lane(n.id));
        section.append(nested);
      });
    return section;
  }
  function open(n) {
    const content = document.getElementById('detail-content');
    content.replaceChildren(
      el('span', 'kind', (n.customKind || n.kind) + ' · ' + n.confidence),
      el('h2', '', headline(n)),
      el('p', '', n.summary),
    );
    if (n.date) content.append(field('Date', dated(n)));
    if (n.endDate) content.append(field('Until', dated({ ...n, date: n.endDate })));
    if (n.originalTimestamp) content.append(field('Source time', n.originalTimestamp));
    if (n.timePrecision) content.append(field('Precision', n.timePrecision));
    n.fields.forEach((f) => content.append(field(f.label, f.value)));
    (n.citations || []).forEach((c) =>
      content.append(
        field(
          'Source',
          [c.source, c.reference, c.locator, c.claim, c.collectedBy, c.collectedAt, c.method, c.url]
            .filter(Boolean)
            .join(' · '),
        ),
      ),
    );
    if (n.tags.length) content.append(field('Tags', n.tags.join(' · ')));
    n.images.forEach((a) => {
      const wrap = el('div', 'attachment'),
        link = el('a', '', a.name);
      link.href = urls.get(a.url);
      link.download = a.name;
      if (imageTypes.includes(a.type)) {
        const img = el('img');
        img.src = urls.get(a.url);
        img.alt = a.name;
        wrap.append(img);
      }
      wrap.append(link);
      if (a.sha256) wrap.append(el('small', '', 'SHA-256 ' + a.sha256));
      content.append(wrap);
    });
    const related = file.threads.filter((t) => t.source === n.id || t.target === n.id);
    if (related.length) content.append(el('h2', '', 'Relationships'));
    related.forEach((t) => {
      const other = find(t.source === n.id ? t.target : t.source);
      const link = button(t.label + ' · ' + headline(other), () => open(other));
      link.append(el('small', 'related-path', branchPath(other.parentId)));
      content.append(link);
    });
    const branch = document.getElementById('branch');
    branch.hidden = !children(n.id).length;
    branch.textContent = 'Open ' + children(n.id).length + ' items in this branch';
    branch.onclick = () => navTo(n.id);
    if (!drawer.open) drawer.showModal();
  }
  function field(label, value) {
    const row = el('div', 'field');
    row.append(el('b', '', label), el('span', '', value));
    return row;
  }
  document.getElementById('relationships').onclick = () => {
    const content = document.getElementById('detail-content');
    content.replaceChildren(
      el('h2', '', 'Relationships'),
      el('p', '', 'Links between cards across this investigation.'),
    );
    for (const t of file.threads) {
      const a = find(t.source),
        b = find(t.target),
        row = el('div', 'field');
      row.style.display = 'block';
      row.append(
        button(headline(a), () => open(a)),
        el('small', 'related-path', branchPath(a.parentId)),
        el('p', '', t.label + (t.dashed ? ' (uncertain)' : '')),
        button(headline(b), () => open(b)),
        el('small', 'related-path', branchPath(b.parentId)),
      );
      (t.citations || []).forEach((c) =>
        row.append(
          field('Source', [c.source, c.reference, c.locator, c.claim].filter(Boolean).join(' · ')),
        ),
      );
      content.append(row);
    }
    if (!file.threads.length) content.append(el('p', '', 'No saved relationships.'));
    document.getElementById('branch').hidden = true;
    if (!drawer.open) drawer.showModal();
  };
  document.getElementById('close').onclick = () => drawer.close();
  drawer.onclick = (e) => {
    if (e.target === drawer && e.clientX < drawer.getBoundingClientRect().left) drawer.close();
  };
  function transform() {
    scene.style.transform =
      'translate(' + camera.x + 'px,' + camera.y + 'px) scale(' + camera.z + ')';
    document.getElementById('zoom-value').textContent = Math.round(camera.z * 100) + '%';
  }
  function fit() {
    const visible = [...scene.querySelectorAll('.card,.label')];
    if (!visible.length) {
      camera = { x: 0, y: 0, z: 1 };
      transform();
      return;
    }
    const boxes = visible.map((e) => {
      const width = e.offsetWidth,
        height = e.offsetHeight,
        x = e.offsetLeft,
        y = e.offsetTop;
      if (e.classList.contains('label'))
        return { x: x - width / 2, y: y - height / 2, width, height };
      const n = find(e.dataset.nodeId),
        angle = ((n.rotation ?? (n.kind === 'Note' ? -2 : 0)) * Math.PI) / 180,
        w = Math.abs(width * Math.cos(angle)) + Math.abs(height * Math.sin(angle)),
        h = Math.abs(height * Math.cos(angle)) + Math.abs(width * Math.sin(angle));
      return { x: x + (width - w) / 2, y: y + (height - h) / 2, width: w, height: h };
    });
    const minX = Math.min(...boxes.map((n) => n.x)),
      minY = Math.min(...boxes.map((n) => n.y)),
      maxX = Math.max(...boxes.map((n) => n.x + n.width)),
      maxY = Math.max(...boxes.map((n) => n.y + n.height));
    const z = Math.max(
      0.15,
      Math.min(
        1,
        (board.clientWidth - 70) / (maxX - minX),
        (board.clientHeight - 100) / (maxY - minY),
      ),
    );
    camera = { z, x: (board.clientWidth - (maxX - minX) * z) / 2 - minX * z, y: 35 - minY * z };
    transform();
  }

  function zoom(factor) {
    const z = Math.max(0.15, Math.min(2, camera.z * factor)),
      x = board.clientWidth / 2,
      y = board.clientHeight / 2;
    camera = { z, x: x - ((x - camera.x) * z) / camera.z, y: y - ((y - camera.y) * z) / camera.z };
    transform();
  }
  board.onpointerdown = (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    gesture = { x: e.clientX, y: e.clientY, ox: camera.x, oy: camera.y };
    board.setPointerCapture(e.pointerId);
  };
  board.onpointermove = (e) => {
    if (!gesture) return;
    camera.x = gesture.ox + e.clientX - gesture.x;
    camera.y = gesture.oy + e.clientY - gesture.y;
    transform();
  };
  board.onpointerup = board.onpointercancel = () => (gesture = null);
  board.onwheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoom(e.deltaY > 0 ? 0.93 : 1.07);
    else {
      camera.x -= e.deltaX;
      camera.y -= e.deltaY;
      transform();
    }
  };
  document.querySelectorAll('[data-view]').forEach(
    (b) =>
      (b.onclick = () => {
        mode = b.dataset.view;
        render();
        if (mode === 'board') fit();
      }),
  );
  document.getElementById('zoom-in').onclick = () => zoom(1.15);
  document.getElementById('zoom-out').onclick = () => zoom(0.85);
  document.getElementById('fit').onclick = fit;
  render();
  fit();
  window.addEventListener('beforeprint', renderReport);
  window.addEventListener('resize', fit);
})();
`;

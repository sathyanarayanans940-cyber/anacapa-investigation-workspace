import { Plus, Trash2, BookOpen, ChevronRight } from 'lucide-react';
import type { Citation } from '@/lib/case-data';
export function CitationEditor({
  value,
  onChange,
}: {
  value: Citation[];
  onChange: (value: Citation[]) => void;
}) {
  const patch = (id: string, change: Partial<Citation>) =>
    onChange(value.map((c) => (c.id === id ? { ...c, ...change } : c)));
  return (
    <details className="editor-section">
      <summary>
        <span>
          <BookOpen size={15} />
          Sources & citations
        </span>
        <span>
          {value.length || ''}
          <ChevronRight size={15} />
        </span>
      </summary>
      <div className="section-body">
        <p className="field-hint">
          Record the source and the specific statement it supports. A citation can point to a
          document page, interview, website, or recording timestamp.
        </p>
        {value.map((cite, i) => (
          <div className="citation-form" key={cite.id}>
            <div className="section-label">
              Source {i + 1}
              <button
                type="button"
                aria-label={`Remove source ${i + 1}`}
                onClick={() => onChange(value.filter((c) => c.id !== cite.id))}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <label>
              Source name
              <input
                required
                maxLength={300}
                value={cite.source}
                onChange={(e) => patch(cite.id, { source: e.target.value })}
                placeholder="Gate log, witness interview…"
              />
            </label>
            <div className="two-col">
              <label>
                Record / exhibit reference
                <input
                  maxLength={500}
                  value={cite.reference}
                  onChange={(e) => patch(cite.id, { reference: e.target.value })}
                  placeholder="Document 004"
                />
              </label>
              <label>
                Page / timestamp / section
                <input
                  maxLength={500}
                  value={cite.locator}
                  onChange={(e) => patch(cite.id, { locator: e.target.value })}
                  placeholder="Page 3, 00:14:22…"
                />
              </label>
            </div>
            <label>
              Statement supported
              <textarea
                rows={2}
                maxLength={1000}
                value={cite.claim}
                onChange={(e) => patch(cite.id, { claim: e.target.value })}
                placeholder="This source supports the arrival time…"
              />
            </label>
            <label>
              Source URL
              <input
                type="url"
                maxLength={2000}
                value={cite.url}
                onChange={(e) => patch(cite.id, { url: e.target.value })}
                placeholder="https://…"
              />
            </label>
            <div className="two-col">
              <label>
                Collected by
                <input
                  maxLength={200}
                  value={cite.collectedBy}
                  onChange={(e) => patch(cite.id, { collectedBy: e.target.value })}
                />
              </label>
              <label>
                Collection date & zone
                <input
                  maxLength={100}
                  value={cite.collectedAt}
                  onChange={(e) => patch(cite.id, { collectedAt: e.target.value })}
                  placeholder="2026-10-10 14:30 UTC"
                />
              </label>
            </div>
            <label>
              Collection method
              <input
                maxLength={500}
                value={cite.method}
                onChange={(e) => patch(cite.id, { method: e.target.value })}
                placeholder="Provided by witness, downloaded from…"
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="ghost"
          disabled={value.length >= 100}
          onClick={() =>
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                source: '',
                reference: '',
                locator: '',
                claim: '',
                collectedBy: '',
                collectedAt: '',
                method: '',
                url: '',
              },
            ])
          }
        >
          <Plus size={14} />
          Add source
        </button>
      </div>
    </details>
  );
}

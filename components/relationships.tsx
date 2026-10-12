import { wirePath, wireStyleNames } from '@/lib/connection-path';
import { useMemo, useState } from 'react';
import { Link2, Plus, Search, ChevronDown, Pencil, ArrowRight, Layers } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { titleOf, type Evidence, type CaseFile, type Thread } from '@/lib/case-data';
import { branchPath, commonLinks } from '@/lib/relationships';

export function EvidenceChooser({
  nodes,
  value,
  onChange,
  label,
  exclude,
  allowAll = false,
}: {
  nodes: Evidence[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  exclude?: string;
  allowAll?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState('');
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const node = byId.get(value),
    q = query.trim().toLowerCase();
  const choices = nodes.filter(
    (n) =>
      n.id !== exclude &&
      (!q ||
        `${titleOf(n)} ${branchPath(byId, n.parentId)} ${n.fields.map((f) => f.value).join(' ')}`
          .toLowerCase()
          .includes(q)),
  );
  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="evidence-chooser" aria-label={label}>
          <span>
            <strong>{node ? titleOf(node) : allowAll ? 'Entire case' : 'Choose a card'}</strong>
            {node && <small>{branchPath(byId, node.parentId)}</small>}
          </span>
          <ChevronDown size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="evidence-choices" align="start" collisionPadding={12}>
        <label className="relation-search">
          <Search size={15} />
          <input
            autoFocus
            aria-label={`Search ${label.toLowerCase()}`}
            placeholder="Search names, branches, or details"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="evidence-choice-list">
          {allowAll && !q && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              <strong>Entire case</strong>
              <small>All timelines and their relationships</small>
            </button>
          )}
          {choices.slice(0, 80).map((n) => (
            <button
              type="button"
              key={n.id}
              aria-label={`Choose ${titleOf(n)} in ${branchPath(byId, n.parentId)}`}
              onClick={() => {
                onChange(n.id);
                setOpen(false);
              }}
            >
              <strong>{titleOf(n)}</strong>
              <small>{branchPath(byId, n.parentId)}</small>
            </button>
          ))}
          {!choices.length && <p>No matching cards.</p>}
          {choices.length > 80 && <p>Type more to narrow {choices.length} cards.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Relationships({
  file,
  focus,
  onClose,
  onNew,
  onEdit,
  onReveal,
}: {
  file: CaseFile;
  focus: string | null;
  onClose: () => void;
  onNew: (source: string, target?: string, label?: string) => void;
  onEdit: (thread: Thread) => void;
  onReveal: (id: string) => void;
}) {
  const [view, setView] = useState('saved'),
    [selected, setSelected] = useState(focus || ''),
    [query, setQuery] = useState(''),
    [shown, setShown] = useState(40);
  const byId = useMemo(() => new Map(file.nodes.map((n) => [n.id, n])), [file.nodes]);
  const matches = useMemo(() => commonLinks(file.nodes, file.threads), [file.nodes, file.threads]);
  const relevant = (a: string, b: string, text: string) => {
    const source = byId.get(a),
      target = byId.get(b);
    return (
      (!selected || a === selected || b === selected) &&
      (!query ||
        `${source ? titleOf(source) : ''} ${target ? titleOf(target) : ''} ${text} ${branchPath(byId, source?.parentId ?? null)} ${branchPath(byId, target?.parentId ?? null)}`
          .toLowerCase()
          .includes(query.toLowerCase()))
    );
  };
  const saved = file.threads.filter((t) => relevant(t.source, t.target, t.label));
  const suggestions = matches.filter((m) =>
    relevant(m.source, m.target, m.matches.map((f) => `${f.label} ${f.value}`).join(' ')),
  );
  function pair(source: string, target: string) {
    return (
      <div className="relationship-pair">
        {[source, target].map((id, i) => {
          const n = byId.get(id)!;
          return (
            <div key={id}>
              {i > 0 && <ArrowRight size={14} />}
              <button aria-label={`Show ${titleOf(n)} on board`} onClick={() => onReveal(id)}>
                <strong>{titleOf(n)}</strong>
                <small>{branchPath(byId, n.parentId)}</small>
              </button>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="relationships-window">
        <DialogHeader>
          <DialogTitle>Relationships</DialogTitle>
          <DialogDescription>Connect cards across any timelines in this case.</DialogDescription>
        </DialogHeader>
        <div className="relationships-controls">
          <EvidenceChooser
            nodes={file.nodes}
            value={selected}
            onChange={(id) => {
              setSelected(id);
              setShown(40);
            }}
            label="Focus relationships"
            allowAll
          />
          <button
            className="primary"
            disabled={file.nodes.length < 2}
            onClick={() => onNew(selected || file.nodes[0].id)}
          >
            <Plus size={14} />
            New link
          </button>
        </div>
        <div className="relationship-tabs" role="tablist" aria-label="Relationship views">
          <button
            role="tab"
            aria-selected={view === 'saved'}
            onClick={() => {
              setView('saved');
              setShown(40);
            }}
          >
            <Link2 size={14} />
            Saved links <span>{saved.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={view === 'shared'}
            onClick={() => {
              setView('shared');
              setShown(40);
            }}
          >
            <Layers size={14} />
            Shared details <span>{suggestions.length}</span>
          </button>
        </div>
        <label className="relation-search">
          <Search size={15} />
          <input
            aria-label="Search relationships"
            placeholder="Find a card, branch, or relationship"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShown(40);
            }}
          />
        </label>
        {view === 'shared' && (
          <p className="relationship-note">
            Matching fields and tags are leads to review. They do not confirm a relationship.
            Showing up to 200 pairs from different branches.
          </p>
        )}
        <div
          className="relationship-results"
          role="tabpanel"
          aria-label={view === 'saved' ? 'Saved links' : 'Shared details'}
        >
          {view === 'saved'
            ? saved.slice(0, shown).map((t) => (
                <article className="relationship-entry" key={t.id}>
                  {pair(t.source, t.target)}
                  <div className="relationship-caption">
                    <span>
                      <svg
                        className="connection-line-icon"
                        viewBox="0 0 100 32"
                        aria-label={`${wireStyleNames[t.style || 'curved']} wire${t.dashed ? ', uncertain' : ''}`}
                        role="img"
                      >
                        <path
                          d={wirePath(4, 10, 96, 22, t.style)}
                          stroke={t.color}
                          fill="none"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray={t.dashed ? '6 6' : undefined}
                        />
                      </svg>
                      {t.label || 'Connected'}
                      {t.dashed && <small>Uncertain</small>}
                    </span>
                    <button
                      className="card-edit"
                      aria-label={`Edit relationship ${t.label}`}
                      onClick={() => onEdit(t)}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </article>
              ))
            : suggestions.slice(0, shown).map((m) => (
                <article className="relationship-entry" key={m.source + '-' + m.target}>
                  {pair(m.source, m.target)}
                  <div className="shared-details">
                    {m.matches.slice(0, 4).map((f, i) => (
                      <span key={i}>
                        <small>{f.label}</small>
                        <strong>{f.value}</strong>
                      </span>
                    ))}
                  </div>
                  <button
                    className="shared-link"
                    onClick={() =>
                      onNew(
                        m.source,
                        m.target,
                        `shares ${m.matches[0].label}: ${m.matches[0].value}`.slice(0, 200),
                      )
                    }
                  >
                    <Plus size={13} />
                    Create relationship
                  </button>
                </article>
              ))}
          {(view === 'saved' ? saved : suggestions).length === 0 && (
            <div className="relationships-empty">
              <Link2 size={24} />
              <strong>{view === 'saved' ? 'No links here yet' : 'No shared details found'}</strong>
              <p>
                {view === 'saved'
                  ? 'Use New link to choose any two cards in this case.'
                  : 'Add the same labelled detail or tag to cards in different branches, or create a link manually.'}
              </p>
            </div>
          )}
          {(view === 'saved' ? saved : suggestions).length > shown && (
            <button className="ghost" onClick={() => setShown((v) => v + 40)}>
              Show more
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

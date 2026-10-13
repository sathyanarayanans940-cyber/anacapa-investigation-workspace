import { CitationEditor } from '@/components/citations';
import { apiFetch } from '@/lib/api';
import { useState } from 'react';
import {
  Plus,
  Trash2,
  Upload,
  Pin,
  Layers,
  ExternalLink,
  FileText,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DateTimePicker } from '@/components/date-time-picker';
import { Evidence, NodeKind, colors, descendants } from '@/lib/case-data';
import { toast } from 'sonner';
import { evidenceSchema } from '@/lib/validation';
import { validDateRange } from '@/lib/local-date';
import { cardTypeTone } from '@/lib/card-type-tone';
export function Picker({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <Select value={value} onValueChange={onChange} open={open} onOpenChange={setOpen}>
      <SelectTrigger aria-label={label} className="picker">
        <SelectValue>{selected?.label || 'Choose…'}</SelectValue>
      </SelectTrigger>
      {open && (
        <SelectContent
          className="warm-select"
          position="popper"
          sideOffset={6}
          collisionPadding={12}
        >
          {options.map((o) => (
            <SelectItem value={o.value} key={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      )}
    </Select>
  );
}
export function EvidenceEditor({
  initial,
  nodes,
  onClose,
  onSave,
  onDelete,
  onExplore,
  onAddSubEvent,
  caseId,
  readOnly = false,
  simple = false,
}: {
  initial: Evidence;
  nodes: Evidence[];
  caseId?: string;
  readOnly?: boolean;
  simple?: boolean;
  onClose: () => void;
  onSave: (n: Evidence) => boolean;
  onDelete: () => void;
  onExplore: () => void;
  onAddSubEvent: (parent: Evidence) => void;
}) {
  const [n, setN] = useState(initial),
    [uploading, setUploading] = useState(false),
    [custom, setCustom] = useState(!!initial.customKind),
    [more, setMore] = useState(!simple);
  const patch = (v: Partial<Evidence>) => setN((s) => ({ ...s, ...v }));
  const customTone = cardTypeTone(n);
  const existing = nodes.some((x) => x.id === n.id),
    excluded = new Set([n.id, ...descendants(nodes, n.id)]),
    childCount = nodes.filter((x) => x.parentId === n.id).length;
  async function upload(files: FileList | null) {
    if (!files) return;
    setUploading(true);
    if (n.images.length + files.length > 100) {
      toast.error('Each card can contain up to 100 attachments.');
      setUploading(false);
      return;
    }
    for (const file of Array.from(files)) {
      try {
        if (file.size > 10 * 1024 * 1024) throw Error('Each file must be smaller than 10 MB.');
        const data = new FormData();
        data.append('file', file);
        if (caseId) data.append('caseId', caseId);
        const res = await apiFetch('/api/files', { method: 'POST', body: data });
        const result = (await res.json()) as {
          url: string;
          name: string;
          type: string;
          error?: string;
        };
        if (!res.ok) throw Error(result.error);
        setN((s) => ({ ...s, images: [...s.images, result] }));
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
    setUploading(false);
  }
  function save(action: 'close' | 'explore' | 'add-child' = 'close') {
    if (!n.title.trim()) return;
    if (custom && !n.customKind?.trim()) {
      toast.error('Give your custom type a name.');
      return;
    }
    if (!validDateRange(n.date, n.endDate || '', n.utcOffset)) {
      toast.error('End date must follow the start date.');
      return;
    }
    const value = {
      ...n,
      title: n.title.trim(),
      customKind: custom ? n.customKind?.trim() : undefined,
    };
    const checked = evidenceSchema.safeParse(value);
    if (!checked.success) {
      const issue = checked.error.issues[0];
      toast.error(`${issue.path.join(' · ')}: ${issue.message}`);
      return;
    }
    if (action === 'add-child') {
      onAddSubEvent(value);
      return;
    }
    if (onSave(value) && action === 'explore') onExplore();
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="evidence-window">
        <DialogHeader>
          <div className="eyebrow">
            {existing ? 'YOUR INVESTIGATION' : 'ADD TO YOUR INVESTIGATION'}
          </div>
          <DialogTitle>
            {readOnly ? 'View evidence' : existing ? 'Edit evidence' : 'New evidence'}
          </DialogTitle>
          <DialogDescription>
            {existing
              ? 'Refine the details or follow its timeline.'
              : 'Start with a name. Add only the details you need.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="editor-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="editor-scroll" tabIndex={0} role="region" aria-label="Evidence details">
            <fieldset disabled={readOnly} className="editor-fields">
              {n.parentId && (
                <div className="editor-parent-hint">
                  <Layers size={14} />
                  <span>
                    Sub-event inside{' '}
                    <strong>{nodes.find((x) => x.id === n.parentId)?.title}</strong>
                  </span>
                </div>
              )}
              <label>
                Name
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={n.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Give this evidence a name"
                />
              </label>
              <label>
                Type
                <Picker
                  label="Evidence type"
                  value={custom ? 'custom' : n.kind}
                  onChange={(v) => {
                    setCustom(v === 'custom');
                    if (v === 'custom') patch({ kind: 'Event', customKind: n.customKind || '' });
                    else patch({ kind: v as NodeKind, customKind: undefined });
                  }}
                  options={[
                    ...['Person', 'Event', 'Location', 'Digital', 'Document', 'Note'].map((v) => ({
                      value: v,
                      label: v,
                    })),
                    { value: 'custom', label: 'Custom type…' },
                  ]}
                />
              </label>
              {custom && (
                <label>
                  Custom type
                  <input
                    aria-label="Custom type"
                    required
                    maxLength={80}
                    value={n.customKind || ''}
                    onChange={(e) => patch({ customKind: e.target.value })}
                    placeholder="Interview, transaction, device…"
                  />
                  {n.customKind?.trim() && (
                    <small
                      className="custom-type-colour"
                      style={
                        {
                          '--card-custom-hue': customTone.hue,
                          '--card-custom-saturation': `${customTone.saturation}%`,
                          '--card-custom-lift': `${customTone.lift}%`,
                        } as React.CSSProperties
                      }
                    >
                      <i aria-hidden="true" />A consistent colour for this custom type
                    </small>
                  )}
                </label>
              )}
              <label>
                Notes
                <textarea
                  maxLength={20000}
                  rows={3}
                  value={n.summary}
                  onChange={(e) => patch({ summary: e.target.value })}
                  placeholder="What happened? What does this tell you?"
                />
              </label>
              {more && (
                <CitationEditor
                  value={n.citations || []}
                  onChange={(citations) => patch({ citations })}
                />
              )}
              <label>
                Date & time <span className="label-optional">Optional</span>
                <DateTimePicker
                  label="Date & time"
                  value={n.date}
                  onChange={(v) => patch({ date: v })}
                />
              </label>
              {existing && (
                <section className="editor-subtimeline" aria-label="Sub-timeline">
                  <div>
                    <Layers size={16} />
                    <span>
                      <strong>Sub-timeline</strong>
                      <small>
                        {childCount
                          ? `${childCount} ${childCount === 1 ? 'event' : 'events'} inside this card`
                          : 'Break this card into smaller events.'}
                      </small>
                    </span>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="subtimeline-add"
                      disabled={uploading}
                      onClick={(e) => {
                        if (e.currentTarget.form?.reportValidity()) save('add-child');
                      }}
                    >
                      <Plus size={14} />
                      Add sub-event
                    </button>
                    {childCount > 0 && (
                      <button
                        type="button"
                        className="subtimeline-open"
                        disabled={uploading}
                        onClick={(e) => {
                          if (e.currentTarget.form?.reportValidity()) save('explore');
                        }}
                      >
                        Open
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </section>
              )}
              {more && (
                <details className="editor-section">
                  <summary>
                    <span>
                      <Layers size={15} />
                      Timeline placement
                    </span>
                    <ChevronRight size={15} />
                  </summary>
                  <div className="section-body">
                    <p className="field-hint">
                      Keep it on the case timeline, or place it inside another item.
                    </p>
                    <label>
                      Inside
                      <Picker
                        label="Parent timeline"
                        value={n.parentId || 'root'}
                        onChange={(v) => patch({ parentId: v === 'root' ? null : v })}
                        options={[
                          { value: 'root', label: 'Main case timeline' },
                          ...nodes
                            .filter((x) => !excluded.has(x.id))
                            .map((x) => ({ value: x.id, label: x.title })),
                        ]}
                      />
                    </label>
                    <div className="two-col">
                      <label>
                        UTC offset
                        <input
                          aria-label="UTC offset"
                          value={n.utcOffset || ''}
                          placeholder="+05:30 or -04:00"
                          pattern="[+-](0[0-9]|1[0-3]):[0-5][0-9]|[+-]14:00"
                          onChange={(e) => patch({ utcOffset: e.target.value || undefined })}
                        />
                      </label>
                      <label>
                        Time precision
                        <Picker
                          label="Time precision"
                          value={n.timePrecision || 'exact'}
                          onChange={(v) => patch({ timePrecision: v as Evidence['timePrecision'] })}
                          options={[
                            { value: 'exact', label: 'Exact' },
                            { value: 'approximate', label: 'Approximate' },
                            { value: 'date-only', label: 'Date only' },
                          ]}
                        />
                      </label>
                    </div>
                    <label>
                      Original timestamp
                      <input
                        maxLength={200}
                        value={n.originalTimestamp || ''}
                        onChange={(e) => patch({ originalTimestamp: e.target.value })}
                        placeholder="Keep the source’s timestamp unchanged"
                      />
                    </label>
                    <p className="field-hint">
                      An explicit UTC offset makes order independent of this computer’s time zone.
                      Approximate times remain estimates.
                    </p>
                    <label>
                      End date <span className="label-optional">Optional</span>
                      <DateTimePicker
                        label="End date"
                        value={n.endDate || ''}
                        onChange={(v) => patch({ endDate: v })}
                      />
                    </label>
                  </div>
                </details>
              )}
              <details className="editor-section">
                <summary>
                  <span>
                    <FileText size={15} />
                    Details & attachments
                  </span>
                  <span>
                    {n.fields.length + n.images.length || ''}
                    <ChevronRight size={15} />
                  </span>
                </summary>
                <div className="section-body">
                  <p className="field-hint">
                    Add addresses, phone numbers, links, IPs, or anything useful.
                  </p>
                  <div className="field-section">
                    <div className="section-label">
                      Details
                      <button
                        type="button"
                        disabled={n.fields.length >= 200}
                        onClick={() =>
                          patch({
                            fields: [
                              ...n.fields,
                              { id: crypto.randomUUID(), label: '', value: '' },
                            ],
                          })
                        }
                      >
                        <Plus size={14} />
                        Add field
                      </button>
                    </div>
                    {n.fields.map((f) => (
                      <div className="custom-field" key={f.id}>
                        <input
                          maxLength={100}
                          aria-label="Field label"
                          placeholder="Phone, address, IP…"
                          value={f.label}
                          onChange={(e) =>
                            patch({
                              fields: n.fields.map((x) =>
                                x.id === f.id ? { ...x, label: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        <input
                          maxLength={20000}
                          aria-label={f.label || 'Field value'}
                          placeholder="Value"
                          value={f.value}
                          onChange={(e) =>
                            patch({
                              fields: n.fields.map((x) =>
                                x.id === f.id ? { ...x, value: e.target.value } : x,
                              ),
                            })
                          }
                        />
                        {/^https?:\/\//i.test(f.value) && (
                          <a
                            title="Open link"
                            href={f.value}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink size={16} />
                          </a>
                        )}
                        <button
                          type="button"
                          aria-label="Remove field"
                          onClick={() =>
                            patch({
                              fields: n.fields.filter((x) => x.id !== f.id),
                              titleField: n.titleField === f.id ? 'title' : n.titleField,
                            })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="attachments">
                    {n.images.map((im, i) => (
                      <div className="attachment" key={im.url}>
                        <a href={im.url} target="_blank" rel="noopener noreferrer">
                          {['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
                            im.type,
                          ) ? (
                            <img src={im.url} alt={im.name} />
                          ) : (
                            <FileText />
                          )}
                          <span>
                            {im.name}
                            {im.sha256 && (
                              <small className="attachment-hash" title={im.sha256}>
                                SHA-256 {im.sha256.slice(0, 12)}… · preserved original
                              </small>
                            )}
                          </span>
                        </a>
                        <button
                          type="button"
                          aria-label={`Remove ${im.name}`}
                          onClick={() => patch({ images: n.images.filter((_, j) => i !== j) })}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="upload-box">
                    <Upload size={20} />
                    <span>{uploading ? 'Adding files…' : 'Add images or documents'}</span>
                    <small>Saved on this computer · 10 MB per file</small>
                    <input
                      type="file"
                      multiple
                      disabled={uploading}
                      onChange={(e) => upload(e.target.files)}
                    />
                  </label>
                </div>
              </details>
              {more && (
                <details className="editor-section">
                  <summary>
                    <span>
                      <Pin size={15} />
                      Card appearance & labels
                    </span>
                    <ChevronRight size={15} />
                  </summary>
                  <div className="section-body">
                    <div className="card-size-setting">
                      <span>
                        Board size
                        <small>
                          {n.boardSize
                            ? `${Math.round(n.boardSize.width)} × ${Math.round(n.boardSize.height)} px`
                            : 'Automatic · fits the preview'}
                        </small>
                      </span>
                      {n.boardSize && (
                        <button type="button" onClick={() => patch({ boardSize: undefined })}>
                          Reset card size
                        </button>
                      )}
                    </div>
                    <p className="field-help">
                      Drag the card’s lower-right corner on the board to resize it.
                    </p>
                    <label>
                      Confidence
                      <Picker
                        label="Confidence"
                        value={n.confidence}
                        onChange={(v) => patch({ confidence: v })}
                        options={['Confirmed', 'Likely', 'Unverified'].map((v) => ({
                          value: v,
                          label: v,
                        }))}
                      />
                      <small className="field-help">
                        Sets the card’s shade: Unverified, Likely, or Confirmed.
                      </small>
                    </label>
                    <label>
                      Show as the card title
                      <Picker
                        label="Card headline"
                        value={n.titleField}
                        onChange={(v) => patch({ titleField: v })}
                        options={[
                          { value: 'title', label: 'Name' },
                          ...n.fields.map((f) => ({
                            value: f.id,
                            label: f.label || 'Untitled field',
                          })),
                        ]}
                      />
                    </label>
                    <label>
                      Tags
                      <input
                        value={n.tags.join(', ')}
                        onChange={(e) =>
                          patch({ tags: e.target.value.split(',').map((v) => v.trim()) })
                        }
                        placeholder="Separate tags with commas"
                      />
                    </label>
                    <div className="section-label">
                      Pin color
                      <div className="color-choices">
                        {colors.map((c) => (
                          <button
                            key={c}
                            type="button"
                            aria-label={`Color ${c}`}
                            aria-pressed={c === n.color}
                            style={{ background: c }}
                            onClick={() => patch({ color: c })}
                          />
                        ))}
                      </div>
                    </div>
                    <label className="switch-row">
                      <span>
                        <Pin size={16} />
                        Pin as priority
                      </span>
                      <Switch checked={n.pinned} onCheckedChange={(v) => patch({ pinned: v })} />
                    </label>
                  </div>
                </details>
              )}
            </fieldset>
            {simple && (
              <button
                type="button"
                className="simple-more-fields"
                aria-expanded={more}
                onClick={() => setMore((v) => !v)}
              >
                {more ? 'Show fewer fields' : 'More fields & sources'}
                <ChevronRight size={14} />
              </button>
            )}
          </div>
          <div className="editor-footer">
            {!readOnly && existing && (
              <button className="editor-delete" type="button" onClick={onDelete}>
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            )}
            <div className="editor-actions">
              <button type="button" className="editor-dismiss" onClick={onClose}>
                {readOnly ? 'Close' : 'Cancel'}
              </button>
              {!readOnly && (
                <button type="submit" className="editor-save" disabled={uploading}>
                  {existing ? 'Save changes' : 'Add evidence'}
                </button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

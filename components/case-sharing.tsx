import { useState } from 'react';
import { Download, ShieldCheck, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { apiFetch, caseAction, downloadBlob } from '@/lib/api';
import {
  packInvestigation,
  packageFilename,
  type InvestigationPackage,
  type EncryptedPackage,
} from '@/lib/investigation-package';
import { createInvestigationViewer } from '@/lib/investigation-viewer';
import { sharingCopy } from '@/lib/sharing-copy';
import { titleOf, type CaseFile } from '@/lib/case-data';
import { toast } from 'sonner';
export function CaseSharing({
  file,
  onClose,
  beforeExport,
  localCopy = false,
}: {
  file: CaseFile;
  localCopy?: boolean;
  onClose: () => void;
  beforeExport: () => Promise<boolean>;
}) {
  const advanced = file.security?.mode === 'advanced';
  const [selected, setSelected] = useState(new Set(file.nodes.map((n) => n.id))),
    [redacted, setRedacted] = useState<Set<string>>(new Set()),
    [title, setTitle] = useState(file.title),
    [encrypt, setEncrypt] = useState(advanced),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [omit, setOmit] = useState({
      omitNotes: false,
      omitAttachments: false,
      omitCitations: false,
      omitDescription: false,
    }),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const toggle = (values: Set<string>, id: string) => {
    const next = new Set(values);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  };
  async function download(format: 'editable' | 'viewer') {
    setError('');
    if (encrypt && (password.length < 12 || password !== confirm)) {
      setError('Use a sharing passphrase of at least 12 characters and confirm it.');
      return;
    }
    setBusy('Preparing copy…');
    try {
      if (!(await beforeExport())) throw Error('Save pending changes before sharing this case.');
      const options = {
        ...omit,
        title,
        encrypt,
        password,
        redact: [...redacted],
        ...(selected.size !== file.nodes.length ? { ids: [...selected] } : {}),
      };
      let bundle: InvestigationPackage | EncryptedPackage;
      if (file.security?.managed && !localCopy)
        bundle = (await caseAction(file.id, 'export', options)).bundle;
      else {
        const copy = sharingCopy(file, selected, redacted, { ...omit, title });
        bundle = await packInvestigation(copy, async (url) => {
          const r = await apiFetch(url);
          if (!r.ok) throw Error('An attachment could not be included.');
          return new Uint8Array(await r.arrayBuffer());
        });
        if (encrypt) {
          const r = await apiFetch('/api/packages/encrypt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ bundle, password }),
            }),
            result = await r.json();
          if (!r.ok) throw Error(result.error);
          bundle = result.bundle;
        }
      }
      downloadBlob(
        format === 'viewer' ? createInvestigationViewer(bundle) : JSON.stringify(bundle),
        packageFilename(title, format === 'viewer' ? '.html' : '.anacapa'),
        format === 'viewer' ? 'text/html;charset=utf-8' : 'application/json',
      );
      toast.success(encrypt ? 'Protected investigation downloaded.' : 'Investigation downloaded.');
      setPassword('');
      setConfirm('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="case-sharing-window">
        <DialogHeader>
          <DialogTitle>Save & share</DialogTitle>
          <DialogDescription>
            Create an editable .anacapa file or a view-only HTML copy. Both include the selected
            attachments.
          </DialogDescription>
        </DialogHeader>
        <div className="dialog-form">
          {localCopy && (
            <p className="field-hint" role="status">
              Recovery copy of this window’s unsaved cards and attachments. Server history and
              custody are excluded. Advanced recovery copies remain protected.
            </p>
          )}
          <label>
            Shared case name
            <input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <details className="share-selection">
            <summary>
              <ChevronDown size={14} />
              Choose cards & remove private details
              <span>
                {selected.size} / {file.nodes.length}
              </span>
            </summary>
            <p className="field-hint">
              Only connections between selected cards are included. An item whose parent is excluded
              moves to the top level. Reduced copies exclude history and custody, which may contain
              removed information.
            </p>
            <div className="selection-actions">
              <button
                className="ghost"
                onClick={() => setSelected(new Set(file.nodes.map((n) => n.id)))}
              >
                Select all
              </button>
              <button className="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </div>
            <div className="share-node-list">
              {file.nodes.map((n) => (
                <article key={n.id}>
                  <label className="checkbox-line">
                    <input
                      type="checkbox"
                      checked={selected.has(n.id)}
                      onChange={() => setSelected(toggle(selected, n.id))}
                    />
                    <strong>{titleOf(n)}</strong>
                    <small>{n.customKind || n.kind}</small>
                  </label>
                  {selected.has(n.id) && n.fields.length > 0 && (
                    <div className="share-field-list">
                      {n.fields.map((f) => (
                        <label key={f.id}>
                          <input
                            type="checkbox"
                            checked={!redacted.has(f.id)}
                            onChange={() => setRedacted(toggle(redacted, f.id))}
                          />
                          <span>Include {f.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
            <div className="share-omit">
              {Object.entries({
                omitNotes: 'Exclude notes',
                omitAttachments: 'Exclude attachments',
                omitCitations: 'Exclude sources & citations',
                omitDescription: 'Exclude case description',
              }).map(([key, label]) => (
                <label key={key} className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={omit[key as keyof typeof omit]}
                    onChange={(e) => setOmit({ ...omit, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="security-note">
              Check titles, notes, citations, labels, filenames, and pictures for identifying
              information before sharing. Field removal does not automatically scrub mentions
              elsewhere.
            </p>
          </details>
          <label className="switch-row">
            <span>
              <ShieldCheck size={15} />
              Protect this copy with a passphrase
            </span>
            <Switch checked={encrypt} disabled={advanced} onCheckedChange={setEncrypt} />
          </label>
          {encrypt && (
            <>
              <div className="two-col">
                <label>
                  Sharing passphrase
                  <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Confirm
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              </div>
              <p className="field-hint">
                Use a separate sharing passphrase. Recipients need it for both HTML and .anacapa
                copies. Share it separately from the file.
              </p>
            </>
          )}
          {advanced && (
            <p className="field-hint">
              Advanced cases always export encrypted copies. Local account passwords and folder
              paths are excluded.
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="sharing-buttons">
            <button
              className="primary"
              disabled={!!busy || !selected.size || !title.trim()}
              onClick={() => download('editable')}
            >
              <Download size={15} />
              Download to edit
            </button>
            <button
              className="ghost"
              disabled={!!busy || !selected.size || !title.trim()}
              onClick={() => download('viewer')}
            >
              <Download size={15} />
              Download to view
            </button>
          </div>
          {busy && <p role="status">{busy}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

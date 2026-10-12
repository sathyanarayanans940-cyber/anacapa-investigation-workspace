import { useEffect, useState } from 'react';
import { FolderOpen, ChevronRight, ArrowUp, Shield, Lock, Check, Feather } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import type { InvestigationPackage } from '@/lib/investigation-package';
import type { Workspace } from '@/lib/case-data';
export function FolderPicker({
  initial,
  onSelect,
  onClose,
  title = 'Choose a case location',
}: {
  initial?: string;
  onSelect: (path: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const [folder, setFolder] = useState<{
      path: string;
      parent: string;
      home: string;
      items: string[];
    } | null>(null),
    [draft, setDraft] = useState(initial || ''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function openFolder(value?: string) {
    setBusy(true);
    setError('');
    try {
      const r = await apiFetch(
          '/api/folders' + (value ? '?path=' + encodeURIComponent(value) : ''),
        ),
        result = await r.json();
      if (!r.ok) throw Error(result.error);
      setFolder(result);
      setDraft(result.path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void openFolder(initial);
  }, []);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="folder-window">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Choose a folder on this computer.</DialogDescription>
        </DialogHeader>
        <form
          className="folder-path"
          onSubmit={(e) => {
            e.preventDefault();
            void openFolder(draft);
          }}
        >
          <input
            aria-label="Folder path"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Enter an absolute folder path"
          />
          <button type="submit" className="ghost" disabled={busy}>
            Go
          </button>
        </form>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {folder && (
          <>
            <div className="folder-navigation">
              <button
                className="ghost"
                onClick={() => openFolder(folder.parent)}
                disabled={busy || folder.parent === folder.path}
              >
                <ArrowUp size={15} />
                Parent folder
              </button>
              <button className="ghost" onClick={() => openFolder(folder.home)} disabled={busy}>
                Home
              </button>
            </div>
            <div className="folder-items">
              {folder.items.map((name) => (
                <button
                  key={name}
                  disabled={busy}
                  onClick={() => openFolder(folder.path.replace(/[\\/]$/, '') + '/' + name)}
                >
                  <FolderOpen size={17} />
                  <span>{name}</span>
                  <ChevronRight size={14} />
                </button>
              ))}
              {!folder.items.length && <p>No subfolders here.</p>}
            </div>
            <div className="folder-current">
              <small>Selected folder</small>
              <span>{folder.path}</span>
            </div>
            <button className="primary" disabled={busy} onClick={() => onSelect(folder.path)}>
              <Check size={15} />
              Choose this folder
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function CaseSetup({
  incoming,
  onClose,
  onCreated,
}: {
  incoming?: InvestigationPackage;
  onClose: () => void;
  onCreated: (result: { workspace: Workspace; revision: number }) => void;
}) {
  const [name, setName] = useState(incoming?.investigation.title || ''),
    [description, setDescription] = useState(incoming?.investigation.description || ''),
    [mode, setMode] = useState<'simple' | 'normal' | 'advanced'>(
      incoming?.investigation.controls === 'simple' ? 'simple' : 'normal',
    ),
    [folder, setFolder] = useState(''),
    [choosing, setChoosing] = useState(false),
    [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function create() {
    setError('');
    if (mode === 'advanced' && password !== confirm) {
      setError('The passphrases do not match.');
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch('/api/cases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: name,
            description,
            mode,
            parentFolder: folder,
            username,
            password,
            importBundle: incoming,
          }),
        }),
        result = await r.json();
      if (!r.ok) throw Error(result.error);
      setPassword('');
      setConfirm('');
      onCreated(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
        <DialogContent className="case-setup-window">
          <DialogHeader>
            <DialogTitle>
              {incoming ? 'Open an investigation' : 'Start a new investigation'}
            </DialogTitle>
            <DialogDescription>
              Choose where this case lives and how to protect it.
            </DialogDescription>
          </DialogHeader>
          <form
            className="dialog-form case-setup-form"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <label>
              Case name
              <input
                autoFocus
                required
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Description
              <textarea
                maxLength={20000}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="case-mode-options" role="group" aria-label="Case mode">
              <button
                type="button"
                aria-pressed={mode === 'simple'}
                onClick={() => setMode('simple')}
              >
                <Feather size={18} />
                <strong>Simple</strong>
                <small>
                  Cards, dates, attachments, and connections. Fewer controls. No password.
                </small>
              </button>
              <button
                type="button"
                aria-pressed={mode === 'normal'}
                onClick={() => setMode('normal')}
              >
                <Shield size={18} />
                <strong>Normal</strong>
                <small>
                  All investigation tools. No password. Sources and detailed fields are optional.
                </small>
              </button>
              <button
                type="button"
                aria-pressed={mode === 'advanced'}
                onClick={() => setMode('advanced')}
              >
                <Lock size={18} />
                <strong>Advanced</strong>
                <small>
                  All tools, plus encryption, local accounts, change reasons, and automatic locking.
                </small>
              </button>
            </div>
            <div className="case-folder-choice">
              <span>
                <strong>Case folder</strong>
                <small>{folder || 'Choose a location before creating the case.'}</small>
              </span>
              <button type="button" className="ghost" onClick={() => setChoosing(true)}>
                <FolderOpen size={15} />
                {folder ? 'Change' : 'Choose folder'}
              </button>
            </div>
            <p className="field-hint">
              A new Anacapa folder holds your case, original files, and history. Signed checkpoints
              are saved separately in the app’s local data. Simple changes the controls, not the
              protection: it uses Normal security.
            </p>
            {mode === 'advanced' && (
              <div className="advanced-setup">
                <label>
                  Administrator name
                  <input
                    required
                    maxLength={80}
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your local operator name"
                  />
                </label>
                <label>
                  Passphrase
                  <input
                    required
                    minLength={12}
                    maxLength={1024}
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <label>
                  Confirm passphrase
                  <input
                    required
                    minLength={12}
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
                <p className="security-note">
                  {incoming && (
                    <>
                      This creates a protected copy. The source file and any earlier case copies
                      keep their original protection.
                      <br />
                    </>
                  )}
                  Use at least 12 characters. Keep the passphrase safe: the app cannot reset it.
                  Advanced cases lock after 10 minutes without activity. These protections do not
                  certify a case or deployment for agency use.
                </p>
              </div>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy || !folder || !name.trim()}>
              {busy ? 'Creating case folder…' : incoming ? 'Open as a new case' : 'Create case'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      {choosing && (
        <FolderPicker
          initial={folder || undefined}
          onClose={() => setChoosing(false)}
          onSelect={(path) => {
            setFolder(path);
            setChoosing(false);
          }}
        />
      )}
    </>
  );
}

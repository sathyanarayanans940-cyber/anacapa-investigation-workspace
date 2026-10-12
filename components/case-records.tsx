import { CaseAssurance } from '@/components/case-assurance';
import { CaseStorage } from '@/components/case-storage';
import { useEffect, useState } from 'react';
import { ShieldCheck, History, Download, Lock, Users, Archive, FolderOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { apiFetch, caseAction, downloadBlob } from '@/lib/api';
import type { CaseFile, Workspace } from '@/lib/case-data';
import { FolderPicker } from '@/components/case-setup';
import { Picker } from '@/components/evidence-editor';
import { toast } from 'sonner';
type Audit = {
  sequence: number;
  at: string;
  actor: string;
  role: string;
  action: string;
  reason: string;
  hash: string;
};
export function CaseRecords({
  file,
  onClose,
  onRefresh,
  onLock,
  onMove,
}: {
  file: CaseFile;
  onClose: () => void;
  onRefresh: (reply: { workspace: Workspace; revision: number }) => void;
  onLock: () => void;
  onMove: () => void;
}) {
  const [choosingBackup, setChoosingBackup] = useState(false),
    [backupFolder, setBackupFolder] = useState('');
  const [tab, setTab] = useState('history'),
    [history, setHistory] = useState<{
      events: Audit[];
      importedEvents?: Audit[];
      total: number;
      custody: Record<string, string>[];
    } | null>(null),
    [users, setUsers] = useState<
      {
        username: string;
        role: string;
      }[]
    >([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<any>(null),
    [restore, setRestore] = useState<number | null>(null),
    [reason, setReason] = useState(''),
    [account, setAccount] = useState({ username: '', role: 'viewer', password: '', confirm: '' }),
    [custody, setCustody] = useState({
      from: '',
      to: '',
      when: new Date().toISOString(),
      method: '',
      note: '',
    });
  const managed = file.security?.managed,
    editable = file.security?.role !== 'viewer';
  async function load() {
    try {
      const r = await apiFetch(`/api/cases/${file.id}/history`),
        data = await r.json();
      if (!r.ok) throw Error(data.error);
      setHistory(data);
      setReceipt((current: any) => (current?.sequence === data.total ? current : null));
      if (file.security?.role === 'admin' && file.security.mode === 'advanced') {
        const u = await apiFetch(`/api/cases/${file.id}/users`);
        const value = await u.json();
        if (!u.ok) throw Error(value.error);
        setUsers(value.users || []);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    if (managed) void load();
  }, [file.id]);
  function refreshCase(reply: { workspace: Workspace; revision: number }) {
    onRefresh(reply);
    setReceipt(null);
    void load();
  }
  function chooseTab(next: string) {
    setTab(next);
    if (['history', 'custody', 'accounts'].includes(next)) void load();
  }
  async function action(fn: () => Promise<void>, changesRecords = false) {
    setBusy(true);
    setError('');
    try {
      await fn();
      if (changesRecords) {
        setReceipt(null);
        await load();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
        <DialogContent className="case-records-window">
          <DialogHeader>
            <DialogTitle>Case records</DialogTitle>
            <DialogDescription>
              {file.title} ·{' '}
              {file.security?.mode === 'advanced'
                ? 'Advanced protection'
                : file.controls === 'simple'
                  ? 'Simple controls · Normal protection'
                  : 'Normal mode'}
            </DialogDescription>
          </DialogHeader>
          {!managed ? (
            <div className="dialog-form">
              <FolderOpen size={27} />
              <p>
                This older case uses the original workspace storage. Save a copy in its own case
                folder to enable permanent history, verification, and recovery.
              </p>
              <button className="primary" onClick={onMove}>
                Save to a case folder
              </button>
              <p className="field-hint">
                The existing investigation stays in place. Choose Simple, Normal, or Advanced for
                the new copy.
              </p>
            </div>
          ) : (
            <>
              <div className="record-location">
                <Archive size={16} />
                <span>{file.security?.folder}</span>
                {file.security?.mode === 'advanced' && (
                  <button className="ghost" onClick={onLock}>
                    <Lock size={14} />
                    Lock
                  </button>
                )}
              </div>
              <div className="record-backup">
                <button
                  className="ghost"
                  disabled={busy || !editable}
                  onClick={() => setChoosingBackup(true)}
                >
                  <Archive size={14} />
                  Make a complete backup
                </button>
                {backupFolder && <small role="status">Backup saved: {backupFolder}</small>}
              </div>
              <div className="record-tabs" role="tablist" aria-label="Case record sections">
                {[
                  { id: 'history', name: 'History', Icon: History },
                  { id: 'integrity', name: 'Integrity', Icon: ShieldCheck },
                  { id: 'custody', name: 'Custody', Icon: Archive },
                  { id: 'review', name: 'Review', Icon: ShieldCheck },
                  { id: 'storage', name: 'Storage', Icon: Archive },
                  ...(file.security?.mode === 'advanced' && file.security.role === 'admin'
                    ? [{ id: 'accounts', name: 'Accounts', Icon: Users }]
                    : []),
                ].map(({ id, name, Icon }) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    disabled={busy}
                    onClick={() => chooseTab(id)}
                  >
                    <Icon size={14} />
                    {name}
                  </button>
                ))}
              </div>
              <div className="record-body">
                {tab === 'storage' && <CaseStorage caseId={file.id} />}
                {tab === 'review' && <CaseAssurance file={file} onRefresh={refreshCase} />}{' '}
                {tab === 'history' && (
                  <>
                    <p className="field-hint">
                      Every saved revision has a recovery snapshot. Restoring appends a new revision
                      and keeps the earlier records. Showing the latest 100 of {history?.total || 0}{' '}
                      entries.
                    </p>
                    {restore !== null && (
                      <div className="restore-form">
                        <strong>Restore revision {restore}</strong>
                        <label>
                          Reason
                          <input
                            minLength={5}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Explain what you need to recover"
                          />
                        </label>
                        <div>
                          <button
                            className="primary"
                            disabled={busy || reason.trim().length < 5}
                            onClick={() =>
                              action(async () => {
                                const reply = await caseAction(file.id, 'restore', {
                                  sequence: restore,
                                  reason,
                                });
                                onRefresh(reply);
                                toast.success('Revision restored as a new save.');
                                onClose();
                              })
                            }
                          >
                            Restore as a new revision
                          </button>
                          <button className="ghost" onClick={() => setRestore(null)}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {history?.events.map((e) => (
                      <article className="audit-entry" key={e.sequence}>
                        <div>
                          <strong>
                            Revision {e.sequence} · {e.action.replaceAll('-', ' ')}
                          </strong>
                          {editable && e.action !== 'attachment-collected' && (
                            <button
                              className="ghost"
                              onClick={() => {
                                setRestore(e.sequence);
                                setReason('');
                              }}
                            >
                              Restore
                            </button>
                          )}
                        </div>
                        <small>
                          {new Date(e.at).toLocaleString()} · {e.actor} · {e.role}
                        </small>
                        <p>{e.reason}</p>
                        <code title={e.hash}>{e.hash.slice(0, 20)}…</code>
                      </article>
                    ))}
                    {!!history?.importedEvents?.length && (
                      <details className="imported-history">
                        <summary>Earlier history supplied with the imported file</summary>
                        <p className="field-hint">
                          These entries are retained as source records. They are outside this case
                          folder’s local history chain and cannot be restored here.
                        </p>
                        {history.importedEvents.map((e, i) => (
                          <article className="audit-entry" key={i}>
                            <strong>{e.action.replaceAll('-', ' ')}</strong>
                            <small>
                              {e.at} · {e.actor}
                            </small>
                            <p>{e.reason}</p>
                            <code>{e.hash.slice(0, 20)}…</code>
                          </article>
                        ))}
                      </details>
                    )}
                  </>
                )}
                {tab === 'integrity' && (
                  <div className="dialog-form">
                    <ShieldCheck size={26} />
                    <h3>Check the originals and history</h3>
                    <p>
                      Checks original file hashes, the history chain, and every recovery snapshot.
                      Advanced mode also checks authenticated encryption and keyed history
                      signatures.
                    </p>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          setReceipt(await caseAction(file.id, 'verify'));
                          toast.success('Integrity checks passed.');
                        })
                      }
                    >
                      {busy ? 'Checking case records…' : 'Verify case integrity'}
                    </button>
                    {receipt && (
                      <div className="integrity-result">
                        <strong>Verified · revision {receipt.sequence}</strong>
                        <small>
                          {receipt.assets.length} original attachments ·{' '}
                          {new Date(receipt.checkedAt).toLocaleString()}
                        </small>
                        <code>{receipt.auditHash}</code>
                        {receipt.checkpoint && (
                          <small>
                            Separate signed checkpoint matched. Keep this receipt and its signing
                            key fingerprint independently.
                          </small>
                        )}
                        <button
                          className="ghost"
                          onClick={() =>
                            downloadBlob(
                              JSON.stringify(receipt, null, 2),
                              'anacapa-integrity-receipt.json',
                            )
                          }
                        >
                          <Download size={14} />
                          Download verification receipt
                        </button>
                      </div>
                    )}
                    <p className="security-note">
                      Keep a receipt separately from the case folder to compare checkpoints later.
                      Verification detects changes against the available records; it cannot prove
                      that evidence was truthful when collected or protect against compromise of the
                      whole computer. Review → Separate checkpoints adds comparison against records
                      outside the case folder.
                    </p>
                  </div>
                )}
                {tab === 'custody' && (
                  <>
                    <p className="field-hint">
                      Record transfers and handling here. The recording time and signed-in operator
                      are added automatically. These records document what was reported; the app
                      cannot observe a physical transfer.
                    </p>
                    {history?.custody.map((item) => (
                      <article className="audit-entry" key={item.id}>
                        <strong>
                          {item.from} → {item.to}
                        </strong>
                        <small>
                          {item.when} · {item.method}
                        </small>
                        <p>{item.note}</p>
                        <small>
                          Recorded by {item.recordedBy} · {item.recordedAt}
                        </small>
                      </article>
                    ))}
                    {editable && (
                      <form
                        className="dialog-form custody-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void action(async () => {
                            const result = await caseAction(file.id, 'custody', custody);
                            setHistory(result);
                            setCustody({ ...custody, from: '', to: '', note: '' });
                            toast.success('Custody record added.');
                          }, true);
                        }}
                      >
                        <div className="two-col">
                          <label>
                            From
                            <input
                              required
                              maxLength={2000}
                              value={custody.from}
                              onChange={(e) => setCustody({ ...custody, from: e.target.value })}
                            />
                          </label>
                          <label>
                            To
                            <input
                              required
                              maxLength={2000}
                              value={custody.to}
                              onChange={(e) => setCustody({ ...custody, to: e.target.value })}
                            />
                          </label>
                        </div>
                        <label>
                          Transfer time & zone
                          <input
                            required
                            maxLength={2000}
                            value={custody.when}
                            onChange={(e) => setCustody({ ...custody, when: e.target.value })}
                          />
                        </label>
                        <label>
                          Method
                          <input
                            required
                            maxLength={2000}
                            value={custody.method}
                            onChange={(e) => setCustody({ ...custody, method: e.target.value })}
                            placeholder="Encrypted drive, in person…"
                          />
                        </label>
                        <label>
                          Purpose / notes
                          <textarea
                            required
                            maxLength={2000}
                            value={custody.note}
                            onChange={(e) => setCustody({ ...custody, note: e.target.value })}
                          />
                        </label>
                        <button className="primary" disabled={busy}>
                          Record transfer
                        </button>
                      </form>
                    )}
                  </>
                )}
                {tab === 'accounts' && (
                  <>
                    <p className="field-hint">
                      Accounts are local to this case. Editors can change evidence; Viewers can
                      inspect and export an encrypted copy. Only the Administrator can manage
                      accounts.
                    </p>
                    {users.map((user) => (
                      <div className="case-account" key={user.username}>
                        <span>
                          <strong>{user.username}</strong>
                          <small>{user.role}</small>
                        </span>
                        {user.role !== 'admin' && (
                          <button
                            className="ghost"
                            disabled={busy}
                            onClick={() =>
                              action(async () => {
                                const result = await caseAction(file.id, 'users', {
                                  operation: 'remove',
                                  username: user.username,
                                });
                                setUsers(result.users);
                              }, true)
                            }
                          >
                            Revoke access
                          </button>
                        )}
                      </div>
                    ))}
                    <form
                      className="dialog-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void action(async () => {
                          if (account.password !== account.confirm)
                            throw Error('The passphrases do not match.');
                          const result = await caseAction(file.id, 'users', account);
                          setUsers(result.users);
                          setAccount({ username: '', role: 'viewer', password: '', confirm: '' });
                          toast.success('Local account added.');
                        }, true);
                      }}
                    >
                      <label>
                        Account name
                        <input
                          required
                          maxLength={80}
                          value={account.username}
                          onChange={(e) => setAccount({ ...account, username: e.target.value })}
                        />
                      </label>
                      <label>
                        Access
                        <Picker
                          label="Account access"
                          value={account.role}
                          onChange={(role) => setAccount({ ...account, role })}
                          options={[
                            { value: 'viewer', label: 'Viewer' },
                            { value: 'editor', label: 'Editor' },
                          ]}
                        />
                      </label>
                      <label>
                        Passphrase
                        <input
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={12}
                          value={account.password}
                          onChange={(e) => setAccount({ ...account, password: e.target.value })}
                        />
                      </label>
                      <label>
                        Confirm passphrase
                        <input
                          type="password"
                          autoComplete="new-password"
                          required
                          value={account.confirm}
                          onChange={(e) => setAccount({ ...account, confirm: e.target.value })}
                        />
                      </label>
                      <button className="primary" disabled={busy}>
                        Add account
                      </button>
                    </form>
                  </>
                )}
                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {choosingBackup && (
        <FolderPicker
          title="Choose a backup location"
          onClose={() => setChoosingBackup(false)}
          onSelect={(parentFolder) => {
            setChoosingBackup(false);
            void action(async () => {
              const result = await caseAction(file.id, 'backup', { parentFolder });
              setBackupFolder(result.folder);
              refreshCase(result);
              toast.success('Complete case folder backed up.');
            });
          }}
        />
      )}
    </>
  );
}

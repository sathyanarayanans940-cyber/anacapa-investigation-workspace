import { useEffect, useState } from 'react';
import { FolderOpen, Download, ShieldCheck, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, caseAction, downloadBlob } from '@/lib/api';
import { FolderPicker } from '@/components/case-setup';
import type { CaseFile, Workspace } from '@/lib/case-data';
type Policy = {
  owner: string;
  reference: string;
  reviewDate: string;
  backupDays: number;
  legalHold: boolean;
  handlingNotes: string;
  reviewedBy?: string;
  reviewedAt?: string;
};
const empty: Policy = {
  owner: '',
  reference: '',
  reviewDate: '',
  backupDays: 7,
  legalHold: false,
  handlingNotes: '',
};
export function CaseAssurance({
  file,
  onRefresh,
}: {
  file: CaseFile;
  onRefresh: (r: { workspace: Workspace; revision: number }) => void;
}) {
  const [policy, setPolicy] = useState<Policy>(empty),
    [location, setLocation] = useState(''),
    [fingerprint, setFingerprint] = useState(''),
    [lastBackup, setLastBackup] = useState(''),
    [choosing, setChoosing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [comparison, setComparison] = useState('');
  const admin = file.security?.role === 'admin';
  async function load() {
    const r = await apiFetch(`/api/cases/${file.id}/handling`),
      value = await r.json();
    if (!r.ok) throw Error(value.error);
    setPolicy(value.policy || empty);
    setLocation(value.checkpointFolder || '');
    setFingerprint(value.checkpointFingerprint || '');
    setLastBackup(value.lastBackupAt || '');
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [file.id]);
  async function run(fn: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="assurance-content">
      <section className="assurance-section">
        <h3>
          <ShieldCheck size={16} />
          Separate checkpoints
        </h3>
        <p>
          Each save gets a signed record outside the case folder. Replacing or rolling back only the
          case folder will be detected before editing.
        </p>
        <small>
          {location || 'This older or imported folder does not have local checkpoints yet.'}
        </small>
        {admin && (
          <button className="ghost" disabled={busy} onClick={() => setChoosing(true)}>
            <FolderOpen size={14} />
            {location ? 'Choose a separate drive or folder' : 'Set up checkpoints'}
          </button>
        )}
        {fingerprint && (
          <>
            <label>
              Signing key fingerprint<code className="checkpoint-fingerprint">{fingerprint}</code>
            </label>
            <button
              className="ghost"
              onClick={() =>
                void navigator.clipboard
                  .writeText(fingerprint)
                  .then(() => toast.success('Fingerprint copied.'))
                  .catch(() => toast.error('Copy the fingerprint shown above.'))
              }
            >
              <Copy size={13} />
              Copy fingerprint
            </button>
          </>
        )}
        <p className="field-hint">
          Keep checkpoint receipts on a separately controlled device or drive. The signing key stays
          in the app’s local data. Access to the whole computer can still defeat these safeguards.
        </p>
        <label className="receipt-compare">
          Compare a saved receipt
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              e.target.value = '';
              if (!chosen) return;
              setComparison('');
              void run(async () => {
                if (chosen.size > 1000000) throw Error('Choose a receipt smaller than 1 MB.');
                const result = await caseAction(
                  file.id,
                  'compare-checkpoint',
                  JSON.parse(await chosen.text()),
                );
                setComparison(
                  `Revision ${result.sequence} matches the current history (revision ${result.currentSequence}). ${result.trustedKey ? 'Signature matches this installation’s pinned key.' : 'Signature is valid, but this installation has no pinned key. Confirm the fingerprint separately with the sender.'}`,
                );
              });
            }}
          />
        </label>
        {comparison && (
          <p role="status" className="integrity-result">
            {comparison}
          </p>
        )}
      </section>
      <section className="assurance-section">
        <h3>Case handling</h3>
        <p>
          Record who is responsible and when the case needs review. These settings document your
          workflow; they do not grant agency approval.
        </p>
        <form
          className="dialog-form"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const result = await caseAction(file.id, 'handling', policy);
              onRefresh(result);
              await load();
              toast.success('Case handling settings recorded.');
            });
          }}
        >
          <fieldset disabled={!admin || busy}>
            <label>
              Responsible person / team
              <input
                required
                maxLength={300}
                value={policy.owner}
                onChange={(e) => setPolicy({ ...policy, owner: e.target.value })}
              />
            </label>
            <label>
              Procedure / approval reference <small>Optional</small>
              <input
                maxLength={300}
                value={policy.reference}
                placeholder="Your organisation’s procedure or approval reference"
                onChange={(e) => setPolicy({ ...policy, reference: e.target.value })}
              />
            </label>
            <div className="two-col">
              <label>
                Review date
                <input
                  maxLength={10}
                  pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
                  placeholder="YYYY-MM-DD"
                  value={policy.reviewDate}
                  onChange={(e) => setPolicy({ ...policy, reviewDate: e.target.value })}
                />
              </label>
              <label>
                Backup every (days)
                <input
                  type="number"
                  min={1}
                  max={365}
                  required
                  value={policy.backupDays}
                  onChange={(e) => setPolicy({ ...policy, backupDays: Number(e.target.value) })}
                />
              </label>
            </div>
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={policy.legalHold}
                onChange={(e) => setPolicy({ ...policy, legalHold: e.target.checked })}
              />
              Retention hold / preserve until released
            </label>
            <label>
              Handling instructions
              <textarea
                maxLength={4000}
                rows={3}
                value={policy.handlingNotes}
                placeholder="Approved storage, access, transfer, and backup procedures"
                onChange={(e) => setPolicy({ ...policy, handlingNotes: e.target.value })}
              />
            </label>
            {admin && (
              <button className="primary" type="submit">
                Save handling settings
              </button>
            )}
          </fieldset>
        </form>
        <p className="field-hint">
          Review dates are reminders. Evidence is never deleted automatically.{' '}
          {lastBackup
            ? `Last complete backup: ${new Date(lastBackup).toLocaleString()}.`
            : 'No complete backup recorded on this installation.'}
        </p>
        {policy.reviewedAt && (
          <small>
            Reviewed by {policy.reviewedBy} · {new Date(policy.reviewedAt).toLocaleString()}
          </small>
        )}
      </section>
      <section className="assurance-section">
        <h3>Review this case</h3>
        <p>
          Download the current integrity result, source coverage, time-zone coverage, handling
          settings, and backup status.
        </p>
        <button
          className="ghost"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const r = await apiFetch(`/api/cases/${file.id}/readiness`),
                result = await r.json();
              if (!r.ok) throw Error(result.error);
              downloadBlob(JSON.stringify(result, null, 2), 'anacapa-case-review.json');
            })
          }
        >
          <Download size={14} />
          Download case review
        </button>
        <a href="/validation/report.html" target="_blank" rel="noreferrer">
          View release test results
        </a>
        <p className="security-note">
          Release tests are developer validation, not an independent security review or
          certification. Organisation approval and evidence procedures require review outside
          Anacapa.
        </p>
      </section>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {choosing && (
        <FolderPicker
          title="Choose checkpoint storage outside the case folder"
          onClose={() => setChoosing(false)}
          onSelect={(parentFolder) => {
            setChoosing(false);
            void run(async () => {
              const result = await caseAction(file.id, 'checkpoint', { parentFolder });
              onRefresh(result);
              await load();
              toast.success('Separate checkpoint storage configured.');
            });
          }}
        />
      )}
    </div>
  );
}

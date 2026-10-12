import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Storage = {
  groups: Record<'originals' | 'snapshots' | 'audit' | 'other', { bytes: number; files: number }>;
  totalBytes: number;
  checkpointBytes: number;
  revisions: number;
  skippedLinks: number;
  measuredAt: string;
};
const size = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export function CaseStorage({ caseId }: { caseId: string }) {
  const [storage, setStorage] = useState<Storage | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function measure() {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch(`/api/cases/${caseId}/storage`);
      const value = await response.json();
      if (!response.ok) throw Error(value.error);
      setStorage(value);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void measure();
  }, [caseId]);
  return (
    <section className="case-storage" aria-label="Case storage">
      <div className="section-label">
        <span>Storage on this computer</span>
        <button disabled={busy} onClick={() => void measure()}>
          {busy ? 'Measuring…' : 'Refresh'}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {storage && (
        <>
          <p>
            <strong>{size(storage.totalBytes)}</strong> in this case folder · {storage.revisions}{' '}
            saved revisions
          </p>
          <dl>
            {(
              [
                ['snapshots', 'Recovery snapshots'],
                ['originals', 'Originals & intake records'],
                ['audit', 'History records'],
                ['other', 'Case metadata'],
              ] as const
            ).map(([id, label]) => (
              <div key={id}>
                <dt>{label}</dt>
                <dd>
                  {size(storage.groups[id].bytes)} <small>· {storage.groups[id].files} files</small>
                </dd>
              </div>
            ))}
          </dl>
          <p className="field-hint">
            Separate checkpoint journal: {size(storage.checkpointBytes)}. Measured{' '}
            {new Date(storage.measuredAt).toLocaleString()}.
          </p>
          <p className="field-hint">
            Every saved revision keeps a full recovery snapshot. Originals remain preserved after
            removal from a card. These totals exclude external backup copies and the app’s registry
            and signing key. File sizes may differ from allocated disk space.
          </p>
          {storage.skippedLinks > 0 && (
            <p className="field-hint">{storage.skippedLinks} symbolic links excluded.</p>
          )}
        </>
      )}
    </section>
  );
}

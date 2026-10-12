import { useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { caseAction, apiFetch } from '@/lib/api';
import type { Workspace } from '@/lib/case-data';
import type { InvestigationPackage } from '@/lib/investigation-package';
export function UnlockCase({
  id,
  onClose,
  onUnlocked,
}: {
  id: string;
  onClose: () => void;
  onUnlocked: (reply: { workspace: Workspace; revision: number }) => void;
}) {
  const [username, setUsername] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="access-window">
        <DialogHeader>
          <DialogTitle>Unlock case</DialogTitle>
          <DialogDescription>
            Use a local account for this case. No internet or external account is involved.
          </DialogDescription>
        </DialogHeader>
        <form
          className="dialog-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const reply = await caseAction(id, 'unlock', { username, password });
              setPassword('');
              onUnlocked(reply);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <LockKeyhole size={26} />
          <label>
            Account name
            <input
              autoFocus
              autoComplete="username"
              required
              maxLength={80}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label>
            Passphrase
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Unlocking…' : 'Unlock case'}
          </button>
          <p className="field-hint">
            Advanced cases lock after 10 minutes of inactivity and when the local app server
            restarts.
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function OpenProtectedFile({
  envelope,
  onClose,
  onOpened,
}: {
  envelope: unknown;
  onClose: () => void;
  onOpened: (bundle: InvestigationPackage) => void;
}) {
  const [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="access-window">
        <DialogHeader>
          <DialogTitle>Open protected investigation</DialogTitle>
          <DialogDescription>
            Enter the sharing passphrase supplied with this file.
          </DialogDescription>
        </DialogHeader>
        <form
          className="dialog-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const r = await apiFetch('/api/packages/decrypt', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ envelope, password }),
                }),
                result = await r.json();
              if (!r.ok) throw Error(result.error);
              setPassword('');
              onOpened(result.bundle);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Sharing passphrase
            <input
              autoFocus
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Opening…' : 'Open investigation'}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ChangeReason({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="access-window">
        <DialogHeader>
          <DialogTitle>Record this change</DialogTitle>
          <DialogDescription>
            Advanced mode records who changed evidence and why. Moving or tilting cards does not
            need a reason.
          </DialogDescription>
        </DialogHeader>
        <form
          className="dialog-form"
          onSubmit={(e) => {
            e.preventDefault();
            onConfirm(reason.trim());
          }}
        >
          <label>
            Reason for change
            <textarea
              autoFocus
              required
              minLength={5}
              maxLength={2000}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Corrected the time using the original call record…"
            />
          </label>
          <div className="dialog-footer">
            <button type="button" className="ghost" onClick={onClose}>
              Discard change
            </button>
            <button className="primary" disabled={reason.trim().length < 5}>
              Apply & record
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

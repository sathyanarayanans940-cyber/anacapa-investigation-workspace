// Public-key comparison tool. It never decrypts evidence or changes a case.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { verifyCheckpoint } from './checkpoints.mjs';
const [folder, receiptPath, trustedFingerprint] = process.argv.slice(2);
if (!folder || !receiptPath || !trustedFingerprint) {
  console.error(
    'Usage: node runtime/verify-checkpoint.mjs CASE_FOLDER RECEIPT_JSON TRUSTED_KEY_FINGERPRINT',
  );
  process.exitCode = 1;
} else {
  try {
    const raw = JSON.parse(await readFile(receiptPath, 'utf8')),
      point = raw.checkpoint || raw;
    const result = verifyCheckpoint(point);
    if (result.fingerprint !== trustedFingerprint)
      throw Error('Signing key does not match the fingerprint supplied separately by the sender.');
    const header = JSON.parse(await readFile(path.join(folder, 'case.json'), 'utf8')),
      head = JSON.parse(await readFile(path.join(folder, 'head.json'), 'utf8'));
    if (
      header.id !== point.caseId ||
      head.sequence !== point.sequence ||
      head.auditHash !== point.auditHash ||
      head.snapshotHash !== point.snapshotHash
    )
      throw Error('The current folder does not match this checkpoint.');
    console.log(
      'Signature and current checkpoint match. This is not a full evidence or history verification.',
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

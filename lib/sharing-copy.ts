import type { CaseFile } from './case-data.ts';
import { shareSelection } from './provenance.ts';

export function sharingCopy(
  file: CaseFile,
  selected: Set<string>,
  redacted: Set<string>,
  options: {
    title: string;
    omitDescription: boolean;
    omitNotes: boolean;
    omitAttachments: boolean;
    omitCitations: boolean;
  },
) {
  const copy = shareSelection(file, selected, redacted);
  copy.title = options.title.trim();
  if (options.omitDescription) copy.description = '';
  for (const n of copy.nodes) {
    if (options.omitNotes) n.summary = '';
    if (options.omitAttachments) n.images = [];
    if (options.omitCitations) n.citations = [];
  }
  if (options.omitCitations) copy.threads = copy.threads.map((t) => ({ ...t, citations: [] }));
  return copy;
}

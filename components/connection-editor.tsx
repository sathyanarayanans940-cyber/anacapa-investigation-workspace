import type { Evidence, Thread } from '@/lib/case-data';
import { RotateCcw, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { EvidenceChooser } from '@/components/relationships';
import { WireStylePicker } from '@/components/wire-style';
import { ConnectionColour } from '@/components/connection-colour';
import { Switch } from '@/components/ui/switch';
import { CitationEditor } from '@/components/citations';

export function ConnectionEditor({
  thread,
  nodes,
  editable,
  existing,
  onChange,
  onClose,
  onSave,
  onRemove,
}: {
  thread: Thread;
  nodes: Evidence[];
  editable: boolean;
  existing: boolean;
  onChange: (thread: Thread) => void;
  onClose: () => void;
  onSave: (thread: Thread) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="relationship-editor">
        <DialogHeader>
          <DialogTitle>Connect the details</DialogTitle>
          <DialogDescription>Choose two cards from any timeline in this case.</DialogDescription>
        </DialogHeader>
        {thread && (
          <form
            className="dialog-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (editable && thread.source && thread.target && thread.source !== thread.target)
                onSave(thread);
            }}
          >
            <fieldset disabled={!editable} className="relationship-fields">
              <label>
                From
                <EvidenceChooser
                  nodes={nodes}
                  value={thread.source}
                  exclude={thread.target}
                  label="Source card"
                  onChange={(source) => onChange({ ...thread, source, labelOffset: undefined })}
                />
              </label>
              <label>
                To
                <EvidenceChooser
                  nodes={nodes}
                  value={thread.target}
                  exclude={thread.source}
                  label="Target card"
                  onChange={(target) => onChange({ ...thread, target, labelOffset: undefined })}
                />
              </label>
              <label>
                Relationship
                <input
                  required
                  maxLength={200}
                  value={thread.label}
                  onChange={(e) => onChange({ ...thread, label: e.target.value })}
                />
              </label>
              <WireStylePicker
                value={thread.style || 'curved'}
                colour={thread.color}
                dashed={thread.dashed}
                onChange={(style) => onChange({ ...thread, style })}
              />
              <ConnectionColour
                value={thread.color}
                dashed={thread.dashed}
                shape={thread.style}
                label={thread.label}
                onChange={(color) => onChange({ ...thread, color })}
              />
              {thread.labelOffset && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    const { labelOffset, ...rest } = thread;
                    onChange(rest);
                  }}
                >
                  <RotateCcw size={14} />
                  Reset label position
                </button>
              )}
              <label className="switch-row">
                Uncertain connection (dashed)
                <Switch
                  checked={thread.dashed}
                  onCheckedChange={(v) => onChange({ ...thread, dashed: v })}
                />
              </label>
              <CitationEditor
                value={thread.citations || []}
                onChange={(citations) => onChange({ ...thread, citations })}
              />
              <div className="dialog-footer">
                {existing && (
                  <button
                    className="danger ghost"
                    type="button"
                    onClick={() => onRemove(thread.id)}
                  >
                    <Trash2 size={16} />
                    Remove
                  </button>
                )}
                <button
                  className="primary"
                  type="submit"
                  disabled={!thread.source || !thread.target || thread.source === thread.target}
                >
                  Save connection
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

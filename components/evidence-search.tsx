import type { RefObject } from 'react';
import { Search, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function EvidenceSearch({
  query,
  onChange,
  inputRef,
  open,
  onOpenChange,
  count,
}: {
  query: string;
  onChange: (value: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  count: number;
}) {
  return (
    <>
      <div className="search-box">
        <Search size={16} />
        <input
          ref={inputRef}
          aria-label="Find evidence"
          placeholder="Find a detail"
          value={query}
          onChange={(e) => onChange(e.target.value)}
        />
        {query && (
          <button aria-label="Clear search" onClick={() => onChange('')}>
            <X size={13} />
          </button>
        )}
      </div>
      <button
        className="round-button mobile-search"
        aria-label="Search evidence"
        aria-pressed={!!query}
        onClick={() => onOpenChange(true)}
      >
        <Search size={16} />
      </button>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="search-window">
          <DialogHeader>
            <DialogTitle>Find evidence</DialogTitle>
            <DialogDescription>
              Search names, notes, dates, and details across every timeline.
            </DialogDescription>
          </DialogHeader>
          <form
            className="dialog-form"
            onSubmit={(e) => {
              e.preventDefault();
              onOpenChange(false);
            }}
          >
            <label>
              Search
              <input
                aria-label="Find evidence"
                autoFocus
                placeholder="Name, date, or detail"
                value={query}
                onChange={(e) => onChange(e.target.value)}
              />
            </label>
            <p role="status">
              {count} {count === 1 ? 'item' : 'items'} found
            </p>
            <div className="search-actions">
              <button
                type="button"
                className="ghost"
                disabled={!query}
                onClick={() => onChange('')}
              >
                Clear search
              </button>
              <button className="primary" type="submit">
                Show results
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

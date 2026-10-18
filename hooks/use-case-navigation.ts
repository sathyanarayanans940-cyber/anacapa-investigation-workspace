import { useState } from 'react';

/** Opening a branch resets transient selection, not evidence or zoom preferences. */
export function useCaseNavigation(resetSelection: () => void) {
  const [mode, setMode] = useState('split');
  const [timelineView, setTimelineView] = useState('chart');
  const [scope, setScope] = useState<string | null>(null);
  const navigate = (id: string | null) => {
    setScope(id);
    resetSelection();
  };
  const expandTimeline = (parent: string | null) => {
    navigate(parent);
    setTimelineView('chart');
    setMode('timeline');
  };
  return {
    mode,
    setMode,
    timelineView,
    setTimelineView,
    scope,
    setScope,
    navigate,
    expandTimeline,
  };
}

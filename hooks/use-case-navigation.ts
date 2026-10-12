import { useState } from 'react';

/** Opening a branch resets the camera and transient selection, not evidence. */
export function useCaseNavigation(resetSelection: () => void) {
  const [mode, setMode] = useState('split');
  const [timelineView, setTimelineView] = useState('chart');
  const [scope, setScope] = useState<string | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, z: 1 });
  const navigate = (id: string | null) => {
    setScope(id);
    resetSelection();
    setCamera({ x: 0, y: 0, z: 1 });
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
    camera,
    setCamera,
    navigate,
    expandTimeline,
  };
}

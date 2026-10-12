import { compareEvents } from '@/lib/provenance';
import { wallDateLabel, timeLabel } from '@/lib/local-date';
('use client');
import { useEffect, useRef } from 'react';
import { ChevronRight, Plus, X, Maximize2 } from 'lucide-react';
import { Evidence, titleOf } from '@/lib/case-data';
export function TimelineRibbon({
  nodes,
  parent,
  selected,
  currentScope,
  onNavigate,
  onAdd,
  onExpand,
  root = false,
}: {
  nodes: Evidence[];
  parent: Evidence | null;
  selected: string | null;
  currentScope: string | null;
  onNavigate: (id: string | null) => void;
  onAdd: () => void;
  onExpand: () => void;
  root?: boolean;
}) {
  const track = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLElement>(null);
  const collapsed = selected !== null;
  useEffect(() => {
    if (!collapsed && row.current?.parentElement?.classList.contains('nested-ribbons')) {
      const stack = row.current.parentElement;
      stack.scrollTop = stack.scrollHeight;
    }
  }, [collapsed, parent?.id]);
  const events = nodes
    .filter((n) => n.parentId === (parent?.id || null) && !!n.date)
    .sort(compareEvents);
  useEffect(() => {
    const item = track.current?.querySelector<HTMLElement>('[aria-current="step"]');
    if (item && track.current) {
      const el = track.current;
      if (
        item.offsetLeft < el.scrollLeft ||
        item.offsetLeft + item.offsetWidth > el.scrollLeft + el.clientWidth
      )
        el.scrollTo({
          left: Math.max(0, item.offsetLeft - el.clientWidth / 2 + item.offsetWidth / 2),
          behavior: 'smooth',
        });
    }
  }, [selected]);
  return (
    <section
      ref={row}
      className={`time-ribbon ${root ? 'root-ribbon' : 'child-ribbon'} ${collapsed ? 'collapsed-ribbon' : ''}`}
      data-collapsed={collapsed}
      aria-label={root ? 'Case timeline' : `${parent?.title} sub-timeline`}
    >
      <div className="ribbon-name">
        <button
          onClick={() => onNavigate(parent?.id || null)}
          title={parent ? titleOf(parent) : 'Show the complete case'}
        >
          {root ? (
            <>
              <span className="ribbon-caption">Case timeline</span>
              <span className="ribbon-period">
                {events.length
                  ? wallDateLabel(events[0].date, { month: 'long', year: 'numeric' })
                  : 'No dates yet'}
              </span>
            </>
          ) : (
            <>
              <span className="ribbon-caption">
                <ChevronRight size={12} />
                Sub-timeline
              </span>
              <span className="ribbon-period">{parent && titleOf(parent)}</span>
            </>
          )}
        </button>
      </div>
      <div className="ribbon-scroll" ref={track}>
        {events.length ? (
          <div className="ribbon-events">
            {events.map((n) => (
              <button
                key={n.id}
                className={`ribbon-event ${selected === n.id ? 'is-current' : ''}`}
                aria-current={selected === n.id ? 'step' : undefined}
                aria-label={`Explore ${titleOf(n)}`}
                title={`${titleOf(n)} · ${wallDateLabel(n.date)} ${timeLabel(n)}`}
                onClick={() => onNavigate(currentScope === n.id ? parent?.id || null : n.id)}
              >
                <span className="event-caption">
                  <span className="event-name">
                    {titleOf(n)}
                    {nodes.some((x) => x.parentId === n.id) && <ChevronRight size={11} />}
                  </span>
                  <span className="event-time">
                    {wallDateLabel(n.date)}
                    <span>{timeLabel(n)}</span>
                  </span>
                </span>
                <span className="event-line">
                  <i />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button className="ribbon-empty" onClick={onAdd}>
            Add the first event to this timeline <Plus size={13} />
          </button>
        )}
      </div>
      <div className="ribbon-actions">
        <button
          className="expand-timeline"
          aria-label={root ? 'Expand case timeline' : `Expand ${parent?.title} timeline`}
          title="Expand timeline"
          onClick={onExpand}
        >
          <Maximize2 size={14} />
        </button>
        <button
          aria-label={root ? 'Add timeline event' : `Add event under ${parent?.title}`}
          title="Add event"
          onClick={onAdd}
        >
          <Plus size={15} />
        </button>
        {!root && (
          <button
            aria-label={`Close ${parent?.title} branch`}
            title="Back to parent timeline"
            onClick={() => onNavigate(parent?.parentId || null)}
          >
            <X size={13} />
          </button>
        )}
      </div>
    </section>
  );
}

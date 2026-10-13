import { compareEvents } from '@/lib/provenance';
import { cardTypeTone } from '@/lib/card-type-tone';
import { wallDateLabel, timeLabel, timestamp } from '@/lib/local-date';
('use client');
import { useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Layers,
  Plus,
  Pin,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  StickyNote,
  PanelTop,
  AlignLeft,
  Pencil,
} from 'lucide-react';
import { type Evidence, titleOf } from '@/lib/case-data';
import { timelinePresentation } from '@/lib/timeline-layout';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Props = {
  nodes: Evidence[];
  parent: Evidence | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (n: Evidence) => void;
  onBoard: (id: string) => void;
  onAdd: (parent: string | null) => void;
  onArrange: (id: string, patch: Pick<Partial<Evidence>, 'timelineSide' | 'timelineStyle'>) => void;
  flat?: boolean;
};
const dateLabel = (date: string) =>
  wallDateLabel(date, { month: 'short', day: 'numeric', year: 'numeric' });

export function TimelineStage(props: Props) {
  return (
    <div className="timeline-stage" aria-label="Expanded timeline">
      <TimelineLane {...props} />
    </div>
  );
}
function TimelineLane({
  nodes,
  parent,
  expanded,
  onToggle,
  onEdit,
  onBoard,
  onAdd,
  onArrange,
  flat = false,
  nested = false,
}: Props & { nested?: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const items = nodes
    .filter((n) => flat || n.parentId === (parent?.id ?? null))
    .sort(compareEvents);
  const branches = flat
    ? []
    : items.filter((n) => expanded.has(n.id) && nodes.some((x) => x.parentId === n.id));
  const scroll = (direction: number) =>
    track.current?.scrollBy({
      left: direction * (track.current.clientWidth - 70),
      behavior: 'smooth',
    });
  return (
    <section
      className={`timeline-lane ${branches.length ? 'lane-has-branch' : ''}`}
      aria-label={parent ? `${titleOf(parent)} timeline` : 'Case events'}
    >
      <div className="lane-heading">
        <span>
          {parent ? (
            <>
              <Layers size={13} />
              Inside {titleOf(parent)}
            </>
          ) : (
            <>
              <span className="lane-dot" />
              Sequence of events
            </>
          )}
        </span>
        <div>
          {branches.length > 0 && (
            <button className="lane-return" onClick={() => branches.forEach((n) => onToggle(n.id))}>
              Expand parent timeline
            </button>
          )}
          <button
            aria-label={`Previous events${parent ? ` in ${titleOf(parent)}` : ''}`}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft size={15} />
          </button>
          <button
            aria-label={`Next events${parent ? ` in ${titleOf(parent)}` : ''}`}
            onClick={() => scroll(1)}
          >
            <ChevronRight size={15} />
          </button>
          {nested && parent && (
            <button
              aria-label={`Collapse ${titleOf(parent)} timeline`}
              onClick={() => onToggle(parent.id)}
            >
              <ChevronDown size={15} />
            </button>
          )}
        </div>
      </div>
      <div className="lane-track" ref={track} tabIndex={0} aria-label="Scroll timeline events">
        <div className="stage-events">
          {items.map((n, index) => {
            const children = nodes.filter((x) => x.parentId === n.id).length,
              open = !flat && expanded.has(n.id),
              { side, style } = timelinePresentation(n, index),
              title = titleOf(n);
            const tone = cardTypeTone(n);
            return (
              <article
                key={n.id}
                className={`stage-event stage-${side} stage-style-${style} ${open ? 'stage-event-expanded' : ''} ${!n.date ? 'stage-event-undated' : ''}`}
              >
                <div className="stage-axis">
                  <div className="stage-date">
                    <span>{dateLabel(n.date)}</span>
                    <time
                      dateTime={timestamp(n.date, n.utcOffset) || undefined}
                      title={n.originalTimestamp || undefined}
                    >
                      {timeLabel(n)}
                    </time>
                  </div>
                  <div className="stage-line" aria-hidden="true">
                    <i />
                  </div>
                  <button
                    className="stage-context-title"
                    onClick={() => (children && !flat ? onToggle(n.id) : onBoard(n.id))}
                    aria-label={`Show ${title} on timeline`}
                    aria-expanded={children && !flat ? open : undefined}
                  >
                    {title}
                    {children > 0 && !flat && <ChevronDown size={11} />}
                  </button>
                </div>
                <div
                  className="stage-card"
                  data-confidence={n.confidence.toLowerCase()}
                  data-priority={n.pinned}
                  data-node-id={n.id}
                  data-type={tone.type}
                  style={
                    {
                      '--card-custom-hue': tone.hue,
                      '--card-custom-saturation': `${tone.saturation}%`,
                      '--card-custom-lift': `${tone.lift}%`,
                    } as React.CSSProperties
                  }
                >
                  <div className="stage-card-heading">
                    <span className="stage-kind">
                      {n.customKind || n.kind}
                      <span className="stage-confidence">· {n.confidence}</span>
                      {n.pinned && (
                        <span className="card-priority" title="Pinned as a priority">
                          <Pin size={12} />
                          <span>Priority</span>
                        </span>
                      )}
                    </span>
                    <div className="stage-card-tools">
                      <button
                        className="stage-edit"
                        aria-label={`Edit ${title}`}
                        title="Edit details"
                        onClick={() => onEdit(n)}
                      >
                        <Pencil size={12} />
                      </button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="stage-arrange-trigger"
                            aria-label={`Arrange ${title}`}
                            title="Position & card style"
                          >
                            <SlidersHorizontal size={14} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="timeline-arrange"
                          align="end"
                          sideOffset={8}
                          collisionPadding={12}
                          aria-label={`Arrange ${title}`}
                        >
                          <strong>Arrange on timeline</strong>
                          <span className="arrange-label">Position</span>
                          <div className="arrange-position" role="group" aria-label="Card position">
                            <button
                              aria-pressed={side === 'above'}
                              onClick={() => onArrange(n.id, { timelineSide: 'above' })}
                            >
                              <ArrowUp size={14} />
                              Above line
                            </button>
                            <button
                              aria-pressed={side === 'below'}
                              onClick={() => onArrange(n.id, { timelineSide: 'below' })}
                            >
                              <ArrowDown size={14} />
                              Below line
                            </button>
                          </div>
                          <span className="arrange-label">Card style</span>
                          <div className="arrange-styles" role="group" aria-label="Card style">
                            {(
                              [
                                { id: 'card', label: 'Card', Icon: PanelTop },
                                { id: 'compact', label: 'Compact', Icon: AlignLeft },
                                { id: 'note', label: 'Note', Icon: StickyNote },
                              ] as const
                            ).map(({ id, label, Icon }) => (
                              <button
                                key={id}
                                aria-pressed={style === id}
                                onClick={() => onArrange(n.id, { timelineStyle: id })}
                              >
                                <Icon size={20} />
                                {label}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <button
                    className="stage-card-content"
                    onClick={() => {
                      if (children && !flat) {
                        if (!open) onToggle(n.id);
                      } else onBoard(n.id);
                    }}
                    aria-label={`Open ${title}`}
                  >
                    <h2>{title}</h2>
                    <p>{n.summary || 'No description yet.'}</p>
                    {n.fields[0] && <span className="stage-detail">{n.fields[0].value}</span>}
                    {n.images.find((i) =>
                      ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(i.type),
                    ) &&
                      style === 'card' && (
                        <img
                          className="stage-image"
                          src={
                            n.images.find((i) =>
                              ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(
                                i.type,
                              ),
                            )!.url
                          }
                          alt=""
                        />
                      )}
                  </button>
                  <div className="stage-card-actions">
                    <div className="stage-branch-actions">
                      {children > 0 && !flat && (
                        <button
                          className="stage-branch"
                          aria-expanded={open}
                          onClick={() => onToggle(n.id)}
                        >
                          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />} {children}{' '}
                          {children === 1 ? 'sub-event' : 'sub-events'}
                        </button>
                      )}
                      <button
                        className={children ? 'stage-add-child' : 'stage-first-child'}
                        onClick={() => onAdd(n.id)}
                        aria-label={`Add sub-event inside ${title}`}
                        title="Add an event inside this card"
                      >
                        <span className="card-add-symbol" aria-hidden="true">
                          <Plus size={11} />
                        </span>
                        {children ? '' : 'Sub-event'}
                      </button>
                    </div>
                    <button onClick={() => onBoard(n.id)} aria-label={`Open evidence for ${title}`}>
                      <Layers size={12} />
                      Board
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          <button className="stage-add" onClick={() => onAdd(parent?.id ?? null)}>
            <span className="stage-add-dot">
              <Plus size={17} />
            </span>
            <span>{items.length ? 'Add event' : 'Add the first event'}</span>
          </button>
        </div>
      </div>
      {branches.map((n) => (
        <div className="stage-nested" key={n.id}>
          <TimelineLane
            nested
            nodes={nodes}
            parent={n}
            expanded={expanded}
            onToggle={onToggle}
            onEdit={onEdit}
            onBoard={onBoard}
            onAdd={onAdd}
            onArrange={onArrange}
          />
        </div>
      ))}
    </section>
  );
}

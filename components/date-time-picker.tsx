import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { datePart, parseTypedDate, editorDate, editedDate } from '@/lib/local-date';
export function DateTimePicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const [draft, setDraft] = useState(editorDate(value)),
    [open, setOpen] = useState(false),
    [time, setTime] = useState(value.slice(11, 16) || '00:00');
  const input = useRef<HTMLInputElement>(null),
    timeInput = useRef<HTMLInputElement>(null),
    typedValue = useRef<string | null>(null);
  const selected = value ? new Date(editorDate(value).replace(' ', 'T')) : undefined;
  useEffect(() => {
    if (typedValue.current !== value) setDraft(editorDate(value));
    setTime(value.slice(11, 16) || '00:00');
  }, [value]);
  useEffect(() => {
    input.current?.setCustomValidity(
      parseTypedDate(draft) === null
        ? 'Use YYYY-MM-DD HH:mm, for example 2026-10-10 14:30.'
        : !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
          ? 'Correct the calendar time. Use HH:mm from 00:00 to 23:59.'
          : '',
    );
  }, [draft, time]);
  const setDate = (next: string) => {
    typedValue.current = null;
    setDraft(editorDate(next));
    onChange(editedDate(value, next));
  };
  const choose = (day: Date | undefined) => {
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      timeInput.current?.reportValidity();
      return;
    }
    if (day) setDate(datePart(day) + 'T' + time);
  };
  return (
    <div className="date-control">
      <input
        ref={input}
        aria-label={label}
        value={draft}
        placeholder="YYYY-MM-DD HH:mm"
        onChange={(e) => {
          setDraft(e.target.value);
          const parsed = parseTypedDate(e.target.value);
          e.target.setCustomValidity(
            parsed === null ? 'Use YYYY-MM-DD HH:mm, for example 2026-10-10 14:30.' : '',
          );
          if (parsed !== null) {
            setTime(parsed.slice(11, 16) || '00:00');
            const next = editedDate(value, parsed);
            typedValue.current = next;
            onChange(next);
          }
        }}
        onBlur={(e) => {
          const parsed = parseTypedDate(e.target.value);
          if (parsed !== null) {
            setTime(parsed.slice(11, 16) || '00:00');
            setDraft(editorDate(parsed));
            onChange(editedDate(value, parsed));
          }
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Choose ${label.toLowerCase()}`}
            title="Choose on calendar"
          >
            <CalendarDays size={17} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="date-popover" align="end" collisionPadding={16} sideOffset={8}>
          <div className="date-popover-heading">
            <CalendarDays size={15} />
            <span>{label}</span>
          </div>
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={selected}
            onSelect={choose}
            showOutsideDays
            components={{
              Chevron: ({ orientation }) =>
                orientation === 'left' ? <ChevronLeft size={17} /> : <ChevronRight size={17} />,
            }}
          />
          <div className="calendar-time">
            <Clock3 size={16} />
            <label>
              Time
              <input
                ref={timeInput}
                aria-label={`${label} time`}
                pattern="(?:[01][0-9]|2[0-3]):[0-5][0-9]"
                required
                value={time}
                placeholder="HH:mm"
                maxLength={5}
                onChange={(e) => {
                  setTime(e.target.value);
                  if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(e.target.value))
                    setDate(datePart(selected || new Date()) + 'T' + e.target.value);
                }}
              />
            </label>
            <span>24-hour</span>
          </div>
          <div className="calendar-footer">
            <button
              type="button"
              onClick={() => {
                setDate('');
                setTime('00:00');
                timeInput.current?.setCustomValidity('');
                setOpen(false);
              }}
            >
              Clear
            </button>
            <button type="button" onClick={() => choose(new Date())}>
              Today
            </button>
            <button
              type="button"
              className="calendar-done"
              onClick={() => {
                if (timeInput.current?.reportValidity()) setOpen(false);
              }}
            >
              Done
            </button>
          </div>
          <p className="date-help">Or type a date and time in the field.</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

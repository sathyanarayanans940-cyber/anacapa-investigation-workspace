import { useEffect, useId, useState } from 'react';
import { Check } from 'lucide-react';
import { wirePath, type WireStyle } from '@/lib/connection-path';

export const connectionColours = [
  { name: 'Gold', value: '#b29158' },
  { name: 'Rose', value: '#bf7370' },
  { name: 'Green', value: '#6e987d' },
  { name: 'Blue', value: '#648fbc' },
  { name: 'Violet', value: '#9a7db9' },
  { name: 'Slate', value: '#81969c' },
  { name: 'Neutral', value: '#a58b70' },
];

export function ConnectionColour({
  value,
  dashed,
  label,
  shape = 'curved',
  onChange,
}: {
  value: string;
  dashed: boolean;
  label: string;
  shape?: WireStyle;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const valid = /^#[0-9a-f]{6}$/i.test(hex);
  const selected = connectionColours.find((colour) => colour.value === value.toLowerCase());
  const choose = (colour: string) => {
    setHex(colour);
    onChange(colour);
  };
  return (
    <section className="connection-colour" aria-labelledby={`${id}-heading`}>
      <div className="connection-colour-heading">
        <span id={`${id}-heading`}>Connection colour</span>
        <small>{selected?.name || 'Custom'}</small>
      </div>
      <div className="connection-colour-presets" aria-label="Connection colours">
        {connectionColours.map((colour) => (
          <button
            key={colour.value}
            type="button"
            aria-label={`${colour.name} connection`}
            aria-pressed={colour.value === value.toLowerCase()}
            title={colour.name}
            onClick={() => choose(colour.value)}
          >
            <span style={{ background: colour.value }}>
              {colour.value === value.toLowerCase() && <Check size={14} />}
            </span>
            <small>{colour.name}</small>
          </button>
        ))}
      </div>
      <div className="connection-colour-custom">
        <label className="connection-colour-picker">
          <input
            type="color"
            aria-label="Custom connection colour"
            value={value}
            onChange={(e) => choose(e.target.value)}
          />
          <span>Custom colour</span>
        </label>
        <label className="connection-colour-hex" htmlFor={`${id}-hex`}>
          <span className="sr-only">Connection hex colour</span>
          <input
            id={`${id}-hex`}
            value={hex}
            required
            maxLength={7}
            pattern="#[0-9a-fA-F]{6}"
            spellCheck={false}
            aria-invalid={!valid}
            aria-describedby={!valid ? `${id}-error` : undefined}
            title="Use a colour such as #648fbc"
            onChange={(e) => {
              const next = e.target.value;
              setHex(next);
              if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase());
            }}
          />
        </label>
      </div>
      {!valid && (
        <small className="connection-colour-error" id={`${id}-error`}>
          Use # followed by six colour digits, for example #648fbc.
        </small>
      )}
      <div
        className="connection-colour-preview"
        aria-label="Connection preview"
        style={{ color: value }}
      >
        <svg viewBox="0 0 160 36" aria-hidden="true">
          <path
            d={wirePath(6, 12, 154, 24, shape)}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dashed ? '6 6' : undefined}
          />
          <circle cx="6" cy="12" r="3" fill="currentColor" />
          <circle cx="154" cy="24" r="3" fill="currentColor" />
        </svg>
        <span>{label.trim() || 'Relationship'}</span>
      </div>
      <p className="connection-colour-help">
        Use the same colour for similar relationships. The label keeps the meaning clear.
      </p>
    </section>
  );
}

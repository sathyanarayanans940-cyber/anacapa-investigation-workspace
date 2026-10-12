import { useId } from 'react';
import { wirePath, wireStyles, wireStyleNames, type WireStyle } from '@/lib/connection-path';

export function WireStylePicker({
  value,
  colour,
  dashed,
  onChange,
}: {
  value: WireStyle;
  colour: string;
  dashed: boolean;
  onChange: (style: WireStyle) => void;
}) {
  const id = useId();
  return (
    <section className="wire-style" aria-labelledby={id}>
      <span id={id}>Wire style</span>
      <div className="wire-style-options" aria-label="Wire styles">
        {wireStyles.map((style) => (
          <button
            type="button"
            key={style}
            aria-label={`${wireStyleNames[style]} wire`}
            aria-pressed={value === style}
            onClick={() => onChange(style)}
          >
            <svg viewBox="0 0 120 36" aria-hidden="true" style={{ color: colour }}>
              <path
                d={wirePath(8, 12, 112, 24, style)}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={dashed ? '6 6' : undefined}
              />
            </svg>
            <span>{wireStyleNames[style]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

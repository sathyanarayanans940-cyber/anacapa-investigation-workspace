'use client';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { Appearance, appIcons, resolveAppearance } from '@/lib/appearance';

type Props = {
  value: Appearance;
  onChange: (value: Appearance) => void;
  dark: boolean;
  stored: boolean;
};
export function AppearanceSettings({ value, onChange, dark, stored }: Props) {
  const update = (next: Partial<Appearance>) => onChange({ ...value, ...next });
  const { tone, iconSrc } = resolveAppearance(value, dark);
  const selected = appIcons.find((i) => i.id === value.iconId)!;
  const palettes = dark
    ? ([
        { id: 'midnight', name: 'Dusk', detail: 'Espresso & parchment' },
        { id: 'blueprint', name: 'Slate', detail: 'Charcoal & muted blue' },
      ] as const)
    : ([
        { id: 'paper', name: 'Linen', detail: 'Ivory & warm ink' },
        { id: 'daylight', name: 'Chalk', detail: 'Soft white & stone' },
      ] as const);
  return (
    <div className="appearance-settings">
      <fieldset>
        <legend>Workspace</legend>
        <div className="setting-segments">
          {[
            { id: 'light', name: 'Light', Icon: Sun },
            { id: 'dark', name: 'Dark', Icon: Moon },
            { id: 'system', name: 'System', Icon: Monitor },
          ].map(({ id, name, Icon }) => (
            <label key={id} className={value.mode === id ? 'chosen' : ''}>
              <input
                type="radio"
                name="workspace-mode"
                value={id}
                checked={value.mode === id}
                onChange={() => update({ mode: id as Appearance['mode'] })}
              />
              <Icon size={15} />
              <span>{name}</span>
            </label>
          ))}
        </div>
        <div className="palette-choices">
          {palettes.map((p) => (
            <label
              className={`palette-choice ${(dark ? value.darkTheme : value.lightTheme) === p.id ? 'chosen' : ''}`}
              key={p.id}
            >
              <input
                type="radio"
                name="workspace-palette"
                value={p.id}
                checked={(dark ? value.darkTheme : value.lightTheme) === p.id}
                onChange={() =>
                  update(
                    dark
                      ? { darkTheme: p.id as Appearance['darkTheme'] }
                      : { lightTheme: p.id as Appearance['lightTheme'] },
                  )
                }
              />
              <span className={`palette-chip swatch-${p.id}`}>
                <i />
                <i />
              </span>
              <span>
                <strong>{p.name}</strong>
                <small>{p.detail}</small>
              </span>
              {(dark ? value.darkTheme : value.lightTheme) === p.id && <Check size={13} />}
            </label>
          ))}
        </div>
        {value.mode === 'system' && (
          <p className="settings-note">
            Following your device’s {dark ? 'dark' : 'light'} appearance.
          </p>
        )}
      </fieldset>
      <fieldset>
        <legend>
          App icon <span>{selected.name}</span>
        </legend>
        <div className="app-icon-grid">
          {appIcons.map((icon) => (
            <label
              key={icon.id}
              className={`app-icon-choice ${value.iconId === icon.id ? 'chosen' : ''}`}
              title={`${icon.number} · ${icon.name}`}
            >
              <input
                type="radio"
                name="app-icon"
                value={icon.id}
                aria-label={`${icon.number} ${icon.name}`}
                checked={value.iconId === icon.id}
                onChange={() => update({ iconId: icon.id })}
              />
              <img src={`/icons/${icon.id}-${tone}.svg`} alt="" width="44" height="44" />
              <span>{icon.name}</span>
              {value.iconId === icon.id && <Check size={11} className="icon-check" />}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Icon colour</legend>
        <div className="setting-segments">
          {[
            { id: 'auto', name: 'Automatic' },
            { id: 'light', name: 'Light icon' },
            { id: 'dark', name: 'Dark icon' },
          ].map((option) => (
            <label key={option.id} className={value.iconTone === option.id ? 'chosen' : ''}>
              <input
                type="radio"
                name="icon-colour"
                checked={value.iconTone === option.id}
                onChange={() => update({ iconTone: option.id as Appearance['iconTone'] })}
              />
              {option.name}
            </label>
          ))}
        </div>
        <div className="icon-settings-preview">
          <img src={iconSrc} width="30" height="30" alt={`${selected.name}, ${tone} variant`} />
          <p>
            {value.iconTone === 'auto'
              ? `Follows the workspace. Using the ${tone} icon.`
              : `Always ${value.iconTone}, even when the workspace changes.`}
            <span>Updates the app header and browser tab.</span>
          </p>
        </div>
      </fieldset>
      <details className="install-icon-help">
        <summary>Installed app icon</summary>
        <p>
          New installations use your selected icon and colour. Changing either also updates the
          app’s installation metadata.
        </p>
        <p>
          Your browser controls Dock and home-screen updates. If available, close and reopen the
          app, then choose <strong>Review app update</strong> in its menu. Some browsers require
          reinstalling the shortcut. Dock icons cannot switch instantly with the theme.
        </p>
        <a
          className="ghost"
          href={`/icons/${value.iconId}-${tone}-512.png`}
          download={`anacapa-${value.iconId}-${tone}.png`}
        >
          Download this icon · PNG
        </a>
      </details>
      <p className="settings-save-note" role="status">
        {stored
          ? 'Saved automatically on this device.'
          : 'Changes apply here, but browser storage is unavailable.'}
      </p>
    </div>
  );
}

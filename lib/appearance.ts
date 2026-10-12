export const appIcons = [
  { id: 'original', name: 'Original', number: '00' },
  { id: 'editorial', name: 'Editorial', number: '01' },
  { id: 'threaded', name: 'Threaded a', number: '02' },
  { id: 'waypoints', name: 'Waypoints', number: '03' },
  { id: 'casefold', name: 'Casefold', number: '04' },
  { id: 'archive', name: 'Archive', number: '05' },
  { id: 'common-thread', name: 'Common thread', number: '06' },
  { id: 'bookish', name: 'Bookish', number: '07' },
  { id: 'italic', name: 'Italic', number: '08' },
  { id: 'soft-serif', name: 'Soft serif', number: '09' },
  { id: 'ink', name: 'Ink', number: '10' },
  { id: 'imprint', name: 'Imprint', number: '11' },
  { id: 'signature', name: 'Signature', number: '12' },
] as const;
export type IconId = (typeof appIcons)[number]['id'];
export type Appearance = {
  mode: 'light' | 'dark' | 'system';
  lightTheme: 'paper' | 'daylight';
  darkTheme: 'midnight' | 'blueprint';
  iconId: IconId;
  iconTone: 'auto' | 'light' | 'dark';
};
export const appearanceKey = 'anacapa-appearance-v2';
export const defaultAppearance: Appearance = {
  mode: 'system',
  lightTheme: 'paper',
  darkTheme: 'midnight',
  iconId: 'original',
  iconTone: 'auto',
};
export function readAppearance(raw: string | null, legacyTheme: string | null): Appearance {
  const defaults = { ...defaultAppearance };
  if (legacyTheme === 'midnight' || legacyTheme === 'blueprint') {
    defaults.mode = 'dark';
    defaults.darkTheme = legacyTheme;
  }
  if (legacyTheme === 'paper' || legacyTheme === 'daylight') defaults.lightTheme = legacyTheme;
  let value: Partial<Appearance> = {};
  try {
    const parsed = JSON.parse(raw || 'null');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) value = parsed;
  } catch {}
  return {
    mode: ['light', 'dark', 'system'].includes(value.mode || '') ? value.mode! : defaults.mode,
    lightTheme:
      value.lightTheme === 'paper' || value.lightTheme === 'daylight'
        ? value.lightTheme
        : defaults.lightTheme,
    darkTheme:
      value.darkTheme === 'midnight' || value.darkTheme === 'blueprint'
        ? value.darkTheme
        : defaults.darkTheme,
    iconId: appIcons.some((i) => i.id === value.iconId) ? value.iconId! : defaults.iconId,
    iconTone: ['auto', 'light', 'dark'].includes(value.iconTone || '')
      ? value.iconTone!
      : defaults.iconTone,
  };
}
export function resolveAppearance(value: Appearance, systemDark: boolean) {
  const dark = value.mode === 'dark' || (value.mode === 'system' && systemDark);
  const theme = dark ? value.darkTheme : value.lightTheme;
  const tone = value.iconTone === 'auto' ? (dark ? 'dark' : 'light') : value.iconTone;
  return { dark, theme, tone, iconSrc: `/icons/${value.iconId}-${tone}.svg` };
}

// Enable the requested system-following behaviour once for existing installs.
// Subsequent explicit Light/Dark choices in v2 remain authoritative.
export function loadAppearance(
  current: string | null,
  previous: string | null,
  legacyTheme: string | null,
): Appearance {
  if (current !== null) return readAppearance(current, null);
  return { ...readAppearance(previous, legacyTheme), mode: 'system' };
}

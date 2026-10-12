import { appIcons } from './appearance.ts';

export const pwaCookie = 'anacapa-install-appearance';
export type InstallAppearance = { icon: string; tone: 'light' | 'dark'; theme: string };
export function installAppearance(value: Partial<InstallAppearance>): InstallAppearance {
  return {
    icon: appIcons.some((i) => i.id === value.icon) ? value.icon! : 'original',
    tone: value.tone === 'dark' ? 'dark' : 'light',
    theme: ['paper', 'daylight', 'midnight', 'blueprint'].includes(value.theme || '')
      ? value.theme!
      : 'paper',
  };
}
export function readInstallAppearance(url: string, cookie: string | null): InstallAppearance {
  const params = new URL(url).searchParams;
  let value = {
    icon: params.get('icon') || 'original',
    tone: params.get('tone') || 'light',
    theme: params.get('theme') || 'paper',
  };
  const saved = cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${pwaCookie}=`))
    ?.slice(pwaCookie.length + 1);
  if (saved) {
    try {
      const parsed = JSON.parse(decodeURIComponent(saved));
      if (parsed && typeof parsed === 'object') value = parsed;
    } catch {}
  }
  return installAppearance(value as Partial<InstallAppearance>);
}
export function createManifest(value: InstallAppearance) {
  const selected = installAppearance(value);
  const background =
    { paper: '#f4eee5', daylight: '#f0efe9', midnight: '#28241f', blueprint: '#283032' }[
      selected.theme
    ] || '#f4eee5';
  const base = `/icons/${selected.icon}-${selected.tone}`;
  return {
    id: '/',
    name: 'Anacapa',
    short_name: 'Anacapa',
    description: 'Connect evidence and explore nested timelines.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: background,
    theme_color: background,
    icons: [
      { src: `${base}-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
export function manifestHref(value: InstallAppearance) {
  const selected = installAppearance(value);
  return `/manifest.webmanifest?${new URLSearchParams(selected).toString()}`;
}

'use client';
import { useEffect, useState } from 'react';
import { manifestHref, pwaCookie, createManifest } from '@/lib/pwa';
import {
  Appearance,
  appearanceKey,
  defaultAppearance,
  readAppearance,
  loadAppearance,
  resolveAppearance,
} from '@/lib/appearance';
export function useAppearance() {
  const [preferences, setPreferences] = useState<Appearance>(defaultAppearance);
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);
  const [stored, setStored] = useState(true);
  useEffect(() => {
    try {
      setPreferences(
        loadAppearance(
          localStorage.getItem(appearanceKey),
          localStorage.getItem('anacapa-appearance-v1'),
          localStorage.getItem('anacapa-theme-v2'),
        ),
      );
    } catch {
      setStored(false);
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener('change', sync);
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === appearanceKey || e.key === null)
        setPreferences(readAppearance(e.newValue, null));
    };
    window.addEventListener('storage', onStorage);
    return () => {
      media.removeEventListener('change', sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const resolved = resolveAppearance(preferences, systemDark);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = resolved.theme;
    document.documentElement.classList.toggle('dark', resolved.dark);
    document.documentElement.style.colorScheme = resolved.dark ? 'dark' : 'light';
    const icons = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]');
    if (icons.length)
      icons.forEach((icon) => {
        icon.href = resolved.iconSrc;
        icon.type = 'image/svg+xml';
      });
    else {
      const icon = document.createElement('link');
      icon.rel = 'icon';
      icon.type = 'image/svg+xml';
      icon.href = resolved.iconSrc;
      document.head.appendChild(icon);
    }
    const install = { icon: preferences.iconId, tone: resolved.tone, theme: resolved.theme };
    // The cookie lets installed browsers refetch their previously stored manifest URL
    // and still receive the latest device preference. Query parameters are a fallback.
    document.cookie = `${pwaCookie}=${encodeURIComponent(JSON.stringify(install))}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    function link(rel: string, href: string, type?: string) {
      let element = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement('link');
        element.rel = rel;
        document.head.appendChild(element);
      }
      if (rel === 'manifest') element.crossOrigin = 'use-credentials';
      if (type) element.type = type;
      if (element.getAttribute('href') !== href) element.setAttribute('href', href);
    }
    link('manifest', manifestHref(install), 'application/manifest+json');
    link('apple-touch-icon', `/icons/${preferences.iconId}-${resolved.tone}-180.png`, 'image/png');
    link('shortcut icon', `/icons/${preferences.iconId}-${resolved.tone}-192.png`, 'image/png');
    let colour = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!colour) {
      colour = document.createElement('meta');
      colour.name = 'theme-color';
      document.head.appendChild(colour);
    }
    colour.content = createManifest(install).theme_color;
  }, [ready, resolved.theme, resolved.dark, resolved.iconSrc, resolved.tone, preferences.iconId]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(appearanceKey, JSON.stringify(preferences));
      setStored(true);
    } catch {
      setStored(false);
    }
  }, [ready, preferences]);
  return { preferences, setPreferences, ready, stored, ...resolved };
}

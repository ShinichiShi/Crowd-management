'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';

/** Floating light/dark switch, mounted once in the root layout (choice is remembered in localStorage). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      className="fixed bottom-4 right-4 z-[60] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition hover:scale-105"
    >
      {mounted ? dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" /> : <span className="h-5 w-5" />}
    </button>
  );
}

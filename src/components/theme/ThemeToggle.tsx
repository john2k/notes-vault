"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <button
        type="button"
        className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-xs"
        aria-label="Theme"
      >
        …
      </button>
    );
  }
  const dark = (resolvedTheme || theme) === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs text-[var(--foreground)] hover:opacity-90"
      title="Toggle theme / Thème"
    >
      {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      {dark ? "Light" : "Dark"}
    </button>
  );
}

"use client";

import { useMemo } from "react";

interface OutlineProps {
  content: string;
  onJump?: (heading: string) => void;
}

interface HeadingItem {
  level: number;
  text: string;
}

/**
 * Sticky outline from markdown headings (H1–H3).
 * Outline sticky à partir des titres Markdown (H1–H3).
 */
export function Outline({ content, onJump }: OutlineProps) {
  const items = useMemo(() => {
    const out: HeadingItem[] = [];
    for (const line of content.split("\n")) {
      const m = /^(#{1,3})\s+(.+)$/.exec(line);
      if (m) out.push({ level: m[1].length, text: m[2].trim() });
    }
    return out;
  }, [content]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3 text-xs opacity-50">
        Pas de titres / No headings
      </div>
    );
  }

  return (
    <nav className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider opacity-50">
        Outline
      </div>
      <ul className="space-y-1">
        {items.map((h, i) => (
          <li key={`${h.level}-${h.text}-${i}`}>
            <button
              type="button"
              onClick={() => onJump?.(h.text)}
              className="block w-full truncate text-left text-xs hover:text-[var(--accent)]"
              style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}
            >
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";

interface BacklinksPanelProps {
  notePath: string;
  title: string;
  onOpen: (path: string) => void;
}

export function BacklinksPanel({ notePath, title, onOpen }: BacklinksPanelProps) {
  const [links, setLinks] = useState<Array<{ path: string; title: string }>>([]);

  useEffect(() => {
    void (async () => {
      const res = await fetch(
        `/api/backlinks?path=${encodeURIComponent(notePath)}&title=${encodeURIComponent(title)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setLinks(data.backlinks || []);
    })();
  }, [notePath, title]);

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3">
      <div className="mb-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider opacity-50">
        <Link2 className="h-3 w-3" /> Backlinks
      </div>
      {links.length === 0 ? (
        <p className="text-xs opacity-50">Aucun backlink</p>
      ) : (
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.path}>
              <button
                type="button"
                className="text-left text-xs text-[var(--accent)] hover:underline"
                onClick={() => onOpen(l.path)}
              >
                {l.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

interface Hit {
  path: string;
  title: string;
  snippet: string;
}

interface SearchPanelProps {
  open: boolean;
  onClose: () => void;
  onOpen: (path: string) => void;
}

/**
 * Dedicated FTS search UI with highlighted snippets.
 * UI de recherche FTS dédiée avec extraits surlignés.
 */
export function SearchPanel({ open, onClose, onOpen }: SearchPanelProps) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (!q.trim()) {
        setHits([]);
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setHits(data.hits || []);
      } finally {
        setBusy(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--panel)] shadow-xl">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-3">
        <Search className="h-4 w-4 opacity-50" />
        <input
          autoFocus
          className="w-full bg-transparent text-sm outline-none"
          placeholder="Recherche FTS…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[var(--panel-muted)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {busy ? (
          <p className="px-2 text-xs opacity-50">Searching…</p>
        ) : null}
        {hits.map((h) => (
          <button
            key={h.path}
            type="button"
            onClick={() => {
              onOpen(h.path);
              onClose();
            }}
            className="mb-1 w-full rounded-lg border border-transparent px-3 py-2 text-left hover:border-[var(--border)] hover:bg-[var(--panel-muted)]"
          >
            <div className="text-sm font-medium">{h.title}</div>
            <div className="font-mono text-[10px] opacity-50">{h.path}</div>
            <div
              className="mt-1 text-xs leading-relaxed opacity-80"
              dangerouslySetInnerHTML={{ __html: h.snippet }}
            />
          </button>
        ))}
        {!busy && q && hits.length === 0 ? (
          <p className="px-2 text-xs opacity-50">Aucun résultat</p>
        ) : null}
      </div>
    </div>
  );
}

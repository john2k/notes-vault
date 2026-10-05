"use client";

import { FilePlus2, Folder, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { cn, getNoteColor } from "@/lib/utils";

export interface SidebarNote {
  path: string;
  title: string;
  folder: string;
  color: string;
  pinned: number;
}

interface SidebarProps {
  notes: SidebarNote[];
  activePath?: string | null;
  onSelect: (path: string) => void;
  onCreate: (folder: string) => void;
  onSearch: (query: string) => void;
}

export function Sidebar({
  notes,
  activePath,
  onSelect,
  onCreate,
  onSearch,
}: SidebarProps) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, SidebarNote[]>();
    for (const note of notes) {
      const folder = note.folder || ".";
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(note);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [notes]);

  return (
    <aside className="flex h-full min-h-0 flex-1 flex-col bg-[var(--panel)]">
      <div className="border-b border-[var(--border)] p-3">
        <div className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[var(--foreground)]">
          Notes Vault
        </div>
        <p className="text-[11px] text-[var(--muted,#858585)]">
          File-over-app · local-first
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel-muted)] px-2.5 py-2">
          <Search className="h-4 w-4 text-[var(--muted,#858585)]" />
          <input
            className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted,#858585)]"
            placeholder="Recherche / Search…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearch(e.target.value);
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => onCreate("_inbox")}
          className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-[var(--accent)] px-2 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          <FilePlus2 className="h-4 w-4" />
          Nouvelle note
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {grouped.map(([folder, items]) => (
          <div key={folder} className="mb-3">
            <div className="mb-1 flex items-center gap-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted,#858585)]">
              <Folder className="h-3.5 w-3.5" />
              {folder}
            </div>
            <ul className="space-y-0.5">
              {items.map((note) => {
                const color = getNoteColor(note.color);
                const active = activePath === note.path;
                return (
                  <li key={note.path}>
                    <button
                      type="button"
                      onClick={() => onSelect(note.path)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border-l-[3px] px-2 py-1.5 text-left text-sm transition",
                        active
                          ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
                          : "text-[var(--foreground)] hover:bg-[var(--panel-muted)]"
                      )}
                      style={{ borderLeftColor: color.solid }}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: color.solid }}
                      />
                      <span className="truncate">{note.title}</span>
                      {note.pinned ? (
                        <span
                          className={cn(
                            "ml-auto text-[9px] uppercase tracking-wide",
                            active
                              ? "text-[var(--accent)]"
                              : "text-[var(--muted,#858585)]"
                          )}
                        >
                          pin
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

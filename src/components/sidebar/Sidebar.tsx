"use client";

import { ChevronDown, ChevronRight, FilePlus2, Folder, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn, getNoteColor } from "@/lib/utils";
import {
  NoteContextMenu,
  type NoteContextAction,
} from "@/components/sidebar/NoteContextMenu";

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
  onNoteAction?: (action: NoteContextAction, path: string) => void;
}

const COLLAPSE_KEY = "notes-vault-collapsed-folders";

function loadCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function Sidebar({
  notes,
  activePath,
  onSelect,
  onCreate,
  onSearch,
  onNoteAction,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    path: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    setCollapsed(loadCollapsed());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsed]));
    } catch {
      // ignore
    }
  }, [collapsed]);

  const grouped = useMemo(() => {
    const map = new Map<string, SidebarNote[]>();
    for (const note of notes) {
      const folder = note.folder || ".";
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(note);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [notes]);

  useEffect(() => {
    if (!activePath) return;
    const folder = activePath.includes("/")
      ? activePath.split("/").slice(0, -1).join("/")
      : ".";
    setCollapsed((prev) => {
      if (!prev.has(folder)) return prev;
      const next = new Set(prev);
      next.delete(folder);
      return next;
    });
  }, [activePath]);

  const toggleFolder = (folder: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

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
        {grouped.map(([folder, items]) => {
          const isCollapsed = collapsed.has(folder);
          return (
            <div key={folder} className="mb-1">
              <button
                type="button"
                onClick={() => toggleFolder(folder)}
                className="mb-0.5 flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted,#858585)] hover:bg-[var(--panel-muted)] hover:text-[var(--foreground)]"
                title={isCollapsed ? "Ouvrir / Expand" : "Fermer / Collapse"}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                )}
                <Folder className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{folder}</span>
                <span className="ml-auto tabular-nums opacity-60">
                  {items.length}
                </span>
              </button>

              {!isCollapsed ? (
                <ul className="space-y-0.5 pl-1">
                  {items.map((note) => {
                    const color = getNoteColor(note.color);
                    const active = activePath === note.path;
                    return (
                      <li key={note.path}>
                        <button
                          type="button"
                          onClick={() => onSelect(note.path)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setMenu({
                              x: e.clientX,
                              y: e.clientY,
                              path: note.path,
                              title: note.title,
                            });
                          }}
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
              ) : null}
            </div>
          );
        })}
      </div>

      <NoteContextMenu
        open={Boolean(menu)}
        x={menu?.x || 0}
        y={menu?.y || 0}
        path={menu?.path || ""}
        title={menu?.title || ""}
        onClose={() => setMenu(null)}
        onAction={(action, path) => onNoteAction?.(action, path)}
      />
    </aside>
  );
}

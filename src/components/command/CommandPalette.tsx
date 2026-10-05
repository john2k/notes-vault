"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, Search, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandNote {
  path: string;
  title: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  notes: CommandNote[];
  onOpen: (path: string) => void;
  onCreate: () => void;
  onSearchFocus: () => void;
}

/**
 * Ctrl+K command palette — open / create / jump to search.
 * Palette Ctrl+K — ouvrir / créer / aller à la recherche.
 */
export function CommandPalette({
  open,
  onClose,
  notes,
  onOpen,
  onCreate,
  onSearchFocus,
}: CommandPaletteProps) {
  const [q, setQ] = useState("");

  useEffect(() => {
    if (open) setQ("");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) onClose();
        else {
          // parent toggles open via same shortcut listener
        }
      }
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return notes.slice(0, 12);
    return notes
      .filter(
        (n) =>
          n.title.toLowerCase().includes(needle) ||
          n.path.toLowerCase().includes(needle)
      )
      .slice(0, 12);
  }, [notes, q]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          <Search className="h-4 w-4 opacity-50" />
          <input
            autoFocus
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Rechercher une note, créer… (Ctrl+K)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="max-h-80 overflow-auto p-1">
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--panel-muted)]"
              onClick={() => {
                onCreate();
                onClose();
              }}
            >
              <FilePlus2 className="h-4 w-4" /> Nouvelle note
            </button>
          </li>
          <li>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--panel-muted)]"
              onClick={() => {
                onSearchFocus();
                onClose();
              }}
            >
              <Search className="h-4 w-4" /> Recherche avancée
            </button>
          </li>
          {filtered.map((n) => (
            <li key={n.path}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--panel-muted)]"
                )}
                onClick={() => {
                  onOpen(n.path);
                  onClose();
                }}
              >
                <StickyNote className="h-4 w-4 opacity-60" />
                <span className="truncate">{n.title}</span>
                <span className="ml-auto truncate font-mono text-[10px] opacity-50">
                  {n.path}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

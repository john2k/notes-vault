"use client";

import { FilePlus2, Folder, Search, StickyNote } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

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
    <aside className="flex h-full w-72 flex-col border-r border-zinc-200 bg-zinc-50">
      <div className="border-b border-zinc-200 p-3">
        <div className="text-sm font-semibold tracking-wide text-zinc-800">
          Notes Vault
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-md border bg-white px-2 py-1.5">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Search / Recherche…"
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
          className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md bg-zinc-900 px-2 py-1.5 text-sm text-white"
        >
          <FilePlus2 className="h-4 w-4" />
          New note / Nouvelle note
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {grouped.map(([folder, items]) => (
          <div key={folder} className="mb-3">
            <div className="mb-1 flex items-center gap-1 px-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <Folder className="h-3.5 w-3.5" />
              {folder}
            </div>
            <ul className="space-y-0.5">
              {items.map((note) => (
                <li key={note.path}>
                  <button
                    type="button"
                    onClick={() => onSelect(note.path)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      activePath === note.path
                        ? "bg-zinc-900 text-white"
                        : "hover:bg-zinc-200 text-zinc-800"
                    )}
                  >
                    <StickyNote className="h-3.5 w-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{note.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </aside>
  );
}

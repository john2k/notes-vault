"use client";

import { useEffect, useState } from "react";

interface SmartFolder {
  id: string;
  name: string;
  tag?: string;
  color?: string;
  folder?: string;
}

interface SmartFoldersProps {
  onApply: (filter: { tag?: string; color?: string; folder?: string }) => void;
}

export function SmartFolders({ onApply }: SmartFoldersProps) {
  const [folders, setFolders] = useState<SmartFolder[]>([]);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");

  const reload = async () => {
    const res = await fetch("/api/smart-folders");
    const data = await res.json();
    setFolders(data.folders || []);
  };

  useEffect(() => {
    void reload();
  }, []);

  const add = async () => {
    if (!name.trim()) return;
    const next = [
      ...folders,
      {
        id: crypto.randomUUID(),
        name: name.trim(),
        tag: tag.trim() || undefined,
      },
    ];
    await fetch("/api/smart-folders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folders: next }),
    });
    setName("");
    setTag("");
    setFolders(next);
  };

  return (
    <div className="border-t border-[var(--border)] p-2">
      <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider opacity-50">
        Smart folders
      </div>
      <ul className="mb-2 space-y-0.5">
        {folders.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              className="w-full rounded px-2 py-1 text-left text-xs hover:bg-[var(--panel-muted)]"
              onClick={() =>
                onApply({ tag: f.tag, color: f.color, folder: f.folder })
              }
            >
              {f.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1 px-1">
        <input
          className="w-full rounded border border-[var(--border)] bg-[var(--panel)] px-1.5 py-1 text-[11px]"
          placeholder="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-16 rounded border border-[var(--border)] bg-[var(--panel)] px-1.5 py-1 text-[11px]"
          placeholder="tag"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-stone-800 px-2 text-[11px] text-white"
          onClick={() => void add()}
        >
          +
        </button>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface EmbedNoteProps {
  path: string;
}

/**
 * Minimal note view for HomeHub iframes — interactive checkboxes persist to disk.
 * Vue note minimale pour iframes HomeHub — cases à cocher persistées sur disque.
 */
export function EmbedNoteClient({ path }: EmbedNoteProps) {
  const search = useSearchParams();
  const minimal = search.get("minimal") === "true";
  const theme = search.get("theme") === "dark" ? "dark" : "light";
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/notes/${path.split("/").map(encodeURIComponent).join("/")}`
    );
    if (!res.ok) return;
    const data = await res.json();
    setContent(data.content || "");
    setTitle(data.metadata?.title || path);
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleLine = async (lineIndex: number) => {
    const lines = content.split("\n");
    const line = lines[lineIndex];
    if (!line) return;
    if (/^(\s*[-*]\s+)\[ \]\s+/.test(line)) {
      lines[lineIndex] = line.replace(/^(\s*[-*]\s+)\[ \]\s+/, "$1[x] ");
    } else if (/^(\s*[-*]\s+)\[x\]\s+/i.test(line)) {
      lines[lineIndex] = line.replace(/^(\s*[-*]\s+)\[x\]\s+/i, "$1[ ] ");
    } else {
      return;
    }
    const next = lines.join("\n");
    setContent(next);
    setSaving(true);
    try {
      await fetch(
        `/api/notes/${path.split("/").map(encodeURIComponent).join("/")}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: next }),
        }
      );
    } finally {
      setSaving(false);
    }
  };

  const lines = content.split("\n");

  return (
    <div
      className={
        theme === "dark"
          ? "min-h-screen bg-zinc-950 text-zinc-100"
          : "min-h-screen bg-stone-50 text-zinc-900"
      }
    >
      <div className={`mx-auto max-w-3xl ${minimal ? "p-3" : "p-6"}`}>
        {!minimal ? (
          <header className="mb-4">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold">
              {title}
            </h1>
            <p className="text-xs opacity-60">{path}</p>
          </header>
        ) : null}

        <div className="space-y-1 text-[15px] leading-relaxed">
          {lines.map((line, idx) => {
            const m = /^(\s*[-*]\s+)\[([ xX])\]\s+(.*)$/.exec(line);
            if (m) {
              const checked = m[2].toLowerCase() === "x";
              return (
                <label
                  key={idx}
                  className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => void toggleLine(idx)}
                    className="mt-1"
                  />
                  <span className={checked ? "line-through opacity-60" : ""}>
                    {m[3]}
                  </span>
                </label>
              );
            }
            if (!line.trim()) return <div key={idx} className="h-3" />;
            return (
              <p key={idx} className="whitespace-pre-wrap px-1">
                {line}
              </p>
            );
          })}
        </div>

        {saving ? (
          <div className="mt-3 text-xs opacity-50">Saving… / Enregistrement…</div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { FileCode2 } from "lucide-react";

interface Snippet {
  path: string;
  title: string;
  content: string;
}

interface SnippetLibraryProps {
  open: boolean;
  onClose: () => void;
  onInsert: (content: string) => void;
}

export function SnippetLibrary({ open, onClose, onInsert }: SnippetLibraryProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/snippets");
      const data = await res.json();
      setSnippets(data.snippets || []);
    })();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold">Snippets</h2>
        {snippets.length === 0 ? (
          <p className="text-xs opacity-60">
            Ajoute des fichiers dans <code>vault/_snippets/</code>
          </p>
        ) : (
          <ul className="space-y-2">
            {snippets.map((s) => (
              <li
                key={s.path}
                className="rounded-lg border border-[var(--border)] p-3"
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <FileCode2 className="h-4 w-4" />
                  {s.title}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-teal-800 px-2 py-1 text-xs text-white"
                    onClick={() => {
                      onInsert(s.content);
                      onClose();
                    }}
                  >
                    Insert
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[var(--border)] px-2 py-1 text-xs"
                    onClick={() => void navigator.clipboard.writeText(s.content)}
                  >
                    Copy
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

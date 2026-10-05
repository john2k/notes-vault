"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "@tldraw/tldraw/tldraw.css";

const Tldraw = dynamic(
  async () => (await import("@tldraw/tldraw")).Tldraw,
  { ssr: false }
);

interface CanvasEditorProps {
  /** Relative vault path ending with .canvas */
  path: string;
}

/**
 * Infinite full-page canvas; state saved as clear JSON `.canvas` in the vault.
 * Canevas infini pleine page ; état sauvé en JSON `.canvas` dans le coffre.
 */
export function CanvasEditor({ path }: CanvasEditorProps) {
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState<unknown>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/canvas?path=${encodeURIComponent(path)}`);
      if (r.ok) {
        const data = await r.json();
        if (!cancelled) setInitial(data.data ?? undefined);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [path]);

  const persist = useCallback(
    (snapshot: unknown) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void fetch("/api/canvas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, data: snapshot }),
        });
      }, 1500);
    },
    [path]
  );

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading canvas… / Chargement du canevas…
      </div>
    );
  }

  return (
    <div className="h-full min-h-[70vh] w-full">
      <Tldraw
        snapshot={initial as never}
        onMount={(editor) => {
          editor.store.listen(
            () => {
              persist(editor.store.getStoreSnapshot());
            },
            { source: "user", scope: "document" }
          );
        }}
      />
    </div>
  );
}

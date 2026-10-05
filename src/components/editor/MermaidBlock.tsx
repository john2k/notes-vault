"use client";

import { useEffect, useRef } from "react";

interface MermaidBlockProps {
  chart: string;
}

/**
 * Live Mermaid renderer for fenced ```mermaid blocks.
 */
export function MermaidBlock({ chart }: MermaidBlockProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
      });
      if (!ref.current || cancelled) return;
      const id = `mmd-${Math.random().toString(36).slice(2)}`;
      try {
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (err) {
        if (ref.current) {
          ref.current.innerHTML = `<pre class="text-xs text-red-600">${String(err)}</pre>`;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <div
      ref={ref}
      className="my-3 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--panel)] p-3"
    />
  );
}

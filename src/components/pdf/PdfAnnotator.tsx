"use client";

import { useEffect, useRef, useState } from "react";

interface PdfAnnotatorProps {
  /** Original PDF kept read-only under vault/_attachments/ */
  pdfRelativePath: string;
  /** Companion annotations JSON, e.g. report.pdf.annotations.json */
  annotationsPath: string;
}

interface AnnotationStroke {
  id: string;
  points: Array<{ x: number; y: number }>;
  color: string;
  note?: string;
}

/**
 * PDF binary stays intact (read-only). Drawings/notes go to companion JSON.
 * Le binaire PDF reste intact (RO). Dessins/notes vont dans le JSON compagnon.
 */
export function PdfAnnotator({
  pdfRelativePath,
  annotationsPath,
}: PdfAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [current, setCurrent] = useState<AnnotationStroke | null>(null);

  const pdfSrc = `/api/attachments/${pdfRelativePath
    .replace(/^_attachments\//, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  useEffect(() => {
    (async () => {
      const a = await fetch(
        `/api/annotations?path=${encodeURIComponent(annotationsPath)}`
      );
      if (a.ok) {
        const data = await a.json();
        setStrokes(Array.isArray(data.strokes) ? data.strokes : []);
      }
    })();
  }, [annotationsPath]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const draw = (stroke: AnnotationStroke) => {
      if (stroke.points.length < 2) return;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    };

    strokes.forEach(draw);
    if (current) draw(current);
  }, [strokes, current]);

  const persist = async (next: AnnotationStroke[]) => {
    await fetch("/api/annotations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: annotationsPath, strokes: next }),
    });
  };

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="text-xs text-zinc-500">
        PDF source (read-only) / Source PDF (lecture seule): {pdfRelativePath}
      </div>
      <div className="relative min-h-[70vh] flex-1 overflow-hidden rounded border bg-zinc-100">
        <object
          data={pdfSrc}
          type="application/pdf"
          className="absolute inset-0 h-full w-full"
          aria-label="PDF"
        />
        <canvas
          ref={canvasRef}
          width={900}
          height={1200}
          className="absolute inset-0 h-full w-full cursor-crosshair bg-transparent"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrawing(true);
            setCurrent({
              id: crypto.randomUUID(),
              color: "#e11d48",
              points: [pos(e)],
            });
          }}
          onPointerMove={(e) => {
            if (!drawing || !current) return;
            setCurrent({ ...current, points: [...current.points, pos(e)] });
          }}
          onPointerUp={async () => {
            setDrawing(false);
            if (!current) return;
            const next = [...strokes, current];
            setStrokes(next);
            setCurrent(null);
            await persist(next);
          }}
        />
      </div>
    </div>
  );
}

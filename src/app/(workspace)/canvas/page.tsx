"use client";

import dynamic from "next/dynamic";

const CanvasEditor = dynamic(
  () =>
    import("@/components/canvas/CanvasEditor").then((m) => m.CanvasEditor),
  { ssr: false }
);

export default function CanvasPage() {
  return (
    <div className="h-screen w-screen">
      <CanvasEditor path="Travail/board.canvas" />
    </div>
  );
}

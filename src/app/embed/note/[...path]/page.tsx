import { Suspense } from "react";
import { EmbedNoteClient } from "@/components/embed/EmbedNoteClient";

type Props = { params: Promise<{ path: string[] }> };

export default async function EmbedNotePage({ params }: Props) {
  const path = (await params).path.map(decodeURIComponent).join("/");
  return (
    <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}>
      <EmbedNoteClient path={path} />
    </Suspense>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar, type SidebarNote } from "@/components/sidebar/Sidebar";
import { Editor } from "@/components/editor/Editor";
import { AudioRecorder } from "@/components/media/AudioRecorder";
import type { NoteMetadata } from "@/lib/fs-vault";

interface NotePayload {
  relativePath: string;
  metadata: NoteMetadata;
  content: string;
}

export function WorkspaceApp() {
  const [notes, setNotes] = useState<SidebarNote[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [note, setNote] = useState<NotePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshList = useCallback(async (search?: string) => {
    const url = search
      ? `/api/notes?search=${encodeURIComponent(search)}`
      : "/api/notes";
    const res = await fetch(url);
    const data = await res.json();
    setNotes(data.notes || []);
  }, []);

  const openNote = useCallback(async (path: string) => {
    setError(null);
    setActivePath(path);
    const res = await fetch(
      `/api/notes/${path.split("/").map(encodeURIComponent).join("/")}`
    );
    if (!res.ok) {
      setError("Unable to open note / Impossible d'ouvrir la note");
      return;
    }
    const data = await res.json();
    setNote({
      relativePath: path,
      metadata: data.metadata,
      content: data.content,
    });
  }, []);

  useEffect(() => {
    void refreshList().then(async () => {
      const res = await fetch("/api/notes");
      const data = await res.json();
      const first = data.notes?.[0]?.path as string | undefined;
      if (first) await openNote(first);
    });
  }, [refreshList, openNote]);

  const createNote = async (folder: string) => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Nouvelle note / New note",
        folder,
        content: "# Nouvelle note\n\n",
        tags: [],
        color: "gray",
      }),
    });
    const data = await res.json();
    await refreshList();
    if (data.path) await openNote(data.path);
  };

  const insertAudioLink = (vaultPath: string) => {
    if (!note) return;
    const wiki = `![[${vaultPath.split("/").pop()}]]`;
    const audioTag = `\n\n${wiki}\n\n<audio controls src="/api/attachments/${vaultPath
      .replace(/^_attachments\//, "")
      .split("/")
      .map(encodeURIComponent)
      .join("/")}"></audio>\n`;
    const next = note.content + audioTag;
    setNote({ ...note, content: next });
    void fetch(
      `/api/notes/${note.relativePath.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: next,
          metadata: note.metadata,
        }),
      }
    );
  };

  return (
    <div className="flex h-screen bg-[radial-gradient(circle_at_top_left,#f4f4f5,transparent_40%),linear-gradient(180deg,#fafafa,#f4f4f5)]">
      <Sidebar
        notes={notes}
        activePath={activePath}
        onSelect={(p) => void openNote(p)}
        onCreate={(f) => void createNote(f)}
        onSearch={(q) => void refreshList(q || undefined)}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900">
              {note?.metadata.title || "Notes Vault"}
            </h1>
            <p className="text-xs text-zinc-500">{activePath || "—"}</p>
          </div>
          {note ? (
            <AudioRecorder onUploaded={insertAudioLink} />
          ) : null}
        </header>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {note ? (
          <div className="min-h-0 flex-1">
            <Editor
              key={note.relativePath}
              path={note.relativePath}
              initialContent={note.content}
              initialMetadata={note.metadata}
              onSaved={(meta) => {
                setNote((prev) => (prev ? { ...prev, metadata: meta } : prev));
                void refreshList();
              }}
            />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Select or create a note / Sélectionnez ou créez une note
          </div>
        )}
      </main>
    </div>
  );
}

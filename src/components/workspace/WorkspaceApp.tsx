"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar, type SidebarNote } from "@/components/sidebar/Sidebar";
import type { NoteContextAction } from "@/components/sidebar/NoteContextMenu";
import { Editor } from "@/components/editor/Editor";
import { AudioRecorder } from "@/components/media/AudioRecorder";
import { CommandPalette } from "@/components/command/CommandPalette";
import { SearchPanel } from "@/components/search/SearchPanel";
import { Outline } from "@/components/editor/Outline";
import { BacklinksPanel } from "@/components/sidebar/Backlinks";
import { TasksView } from "@/components/tasks/TasksView";
import { SnippetLibrary } from "@/components/snippets/SnippetLibrary";
import { TemplatePicker } from "@/components/templates/TemplatePicker";
import { SmartFolders } from "@/components/sidebar/SmartFolders";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
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
  const [liveContent, setLiveContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [insertBuf, setInsertBuf] = useState<string | null>(null);

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
    setLiveContent(data.content || "");
  }, []);

  useEffect(() => {
    void refreshList().then(async () => {
      const res = await fetch("/api/notes");
      const data = await res.json();
      const first = data.notes?.[0]?.path as string | undefined;
      if (first) await openNote(first);
    });
  }, [refreshList, openNote]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const createNote = async (folder: string, templatePath?: string) => {
    let content = "# Nouvelle note\n\n";
    let title = "Nouvelle note / New note";
    if (templatePath) {
      const res = await fetch(
        `/api/notes/${templatePath.split("/").map(encodeURIComponent).join("/")}`
      );
      if (res.ok) {
        const data = await res.json();
        content = data.content || content;
        title = `${data.metadata?.title || "Template"} — copie`;
      }
    }
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        folder,
        content,
        tags: [],
        color: "gray",
      }),
    });
    const data = await res.json();
    await refreshList();
    if (data.path) await openNote(data.path);
  };

  const openDailyNote = async () => {
    const day = new Date().toISOString().slice(0, 10);
    const path = `Journal/${day}.md`;
    const existing = await fetch(
      `/api/notes/${path.split("/").map(encodeURIComponent).join("/")}`
    );
    if (existing.ok) {
      await openNote(path);
      return;
    }
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Journal ${day}`,
        folder: "Journal",
        content: `# Journal ${day}\n\n- [ ] \n\n`,
        tags: ["journal"],
        color: "green",
      }),
    });
    const data = await res.json();
    // Force path to daily filename if API used timestamped slug
    if (data.path && data.path !== path) {
      // create exact daily path via PUT
      await fetch(`/api/notes/${path.split("/").map(encodeURIComponent).join("/")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `# Journal ${day}\n\n- [ ] \n\n`,
          metadata: {
            id: data.metadata?.id,
            title: `Journal ${day}`,
            tags: ["journal"],
            color: "green",
          },
        }),
      });
      await refreshList();
      await openNote(path);
      return;
    }
    await refreshList();
    if (data.path) await openNote(data.path);
  };

  const openWikiTarget = async (target: string) => {
    const res = await fetch("/api/notes");
    const data = await res.json();
    const notesList = (data.notes || []) as SidebarNote[];
    const hit =
      notesList.find(
        (n) =>
          n.title.toLowerCase() === target.toLowerCase() ||
          n.path.toLowerCase() === target.toLowerCase() ||
          n.path.toLowerCase().endsWith(`/${target.toLowerCase()}.md`) ||
          n.path.toLowerCase() === `${target.toLowerCase()}.md`
      ) || null;
    if (hit) await openNote(hit.path);
    else {
      setError(`Wikilink introuvable: ${target}`);
    }
  };

  const insertAudioLink = (vaultPath: string) => {
    if (!note) return;
    const wiki = `![[${vaultPath.split("/").pop()}]]`;
    const audioTag = `\n\n${wiki}\n\n<audio controls src="/api/attachments/${vaultPath
      .replace(/^_attachments\//, "")
      .split("/")
      .map(encodeURIComponent)
      .join("/")}"></audio>\n`;
    setInsertBuf(audioTag);
  };

  const applySmartFilter = async (filter: {
    tag?: string;
    color?: string;
    folder?: string;
  }) => {
    const params = new URLSearchParams();
    if (filter.tag) params.set("tag", filter.tag);
    if (filter.color) params.set("color", filter.color);
    const res = await fetch(`/api/notes?${params.toString()}`);
    const data = await res.json();
    let list = (data.notes || []) as SidebarNote[];
    if (filter.folder) {
      list = list.filter((n) => n.folder === filter.folder);
    }
    setNotes(list);
  };

  const handleNoteAction = async (action: NoteContextAction, path: string) => {
    try {
      if (action === "rename") {
        const current = notes.find((n) => n.path === path);
        const title = window.prompt("Nouveau titre / New title", current?.title || "");
        if (!title?.trim()) return;
        const res = await fetch("/api/notes/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rename", path, title: title.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Rename failed");
        await refreshList();
        if (data.path) await openNote(data.path);
        return;
      }

      if (action === "move") {
        const foldersRes = await fetch("/api/notes/actions?list=folders");
        const foldersData = await foldersRes.json();
        const folders = (foldersData.folders || []) as string[];
        const choice = window.prompt(
          `Dossier cible / Target folder:\n${folders.join(", ")}`,
          path.includes("/") ? path.split("/").slice(0, -1).join("/") : "_inbox"
        );
        if (!choice?.trim()) return;
        const res = await fetch("/api/notes/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "move",
            path,
            folder: choice.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Move failed");
        await refreshList();
        if (data.path) await openNote(data.path);
        return;
      }

      if (action === "copy") {
        const res = await fetch("/api/notes/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "copy", path }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Copy failed");
        await refreshList();
        if (data.path) await openNote(data.path);
        return;
      }

      if (action === "export") {
        const res = await fetch("/api/notes/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "export", path }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Export failed");
        }
        const blob = await res.blob();
        const filename = path.split("/").pop() || "note.md";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      if (action === "trash") {
        if (!window.confirm(`Envoyer « ${path} » à la corbeille ?`)) return;
        const res = await fetch(
          `/api/notes/${path.split("/").map(encodeURIComponent).join("/")}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Trash failed");
        await refreshList();
        if (activePath === path) {
          setNote(null);
          setActivePath(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <div className="flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--panel)]">
        <Sidebar
          notes={notes}
          activePath={activePath}
          onSelect={(p) => void openNote(p)}
          onCreate={() => setTemplatesOpen(true)}
          onSearch={(q) => void refreshList(q || undefined)}
          onNoteAction={(action, path) => void handleNoteAction(action, path)}
        />
        <SmartFolders onApply={(f) => void applySmartFilter(f)} />
      </div>

      <main className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)]/80 px-4 py-3 shadow-sm backdrop-blur">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--foreground)]">
              {note?.metadata.title || "Notes Vault"}
            </h1>
            <p className="font-mono text-[11px] opacity-60">{activePath || "—"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs"
              onClick={() => setPaletteOpen(true)}
            >
              Ctrl+K
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs"
              onClick={() => setSearchOpen(true)}
            >
              Recherche
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs"
              onClick={() => void openDailyNote()}
            >
              Journal
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs"
              onClick={() => setTasksOpen(true)}
            >
              Tâches
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs"
              onClick={() => setSnippetsOpen(true)}
            >
              Snippets
            </button>
            <a
              href="/api/export"
              className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs"
            >
              Export ZIP
            </a>
            <label className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs">
              Import MD
              <input
                type="file"
                accept=".md"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (!files?.length) return;
                  void (async () => {
                    const form = new FormData();
                    Array.from(files).forEach((f) => form.append("files", f));
                    await fetch("/api/import", { method: "POST", body: form });
                    await refreshList();
                  })();
                }}
              />
            </label>
            <a
              href="/canvas"
              className="rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs"
            >
              Canvas
            </a>
            {note ? <AudioRecorder onUploaded={insertAudioLink} /> : null}
          </div>
        </header>

        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {note ? (
          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="min-h-0 min-w-0">
              <Editor
                key={note.relativePath}
                path={note.relativePath}
                initialContent={note.content}
                initialMetadata={note.metadata}
                externalInsert={insertBuf}
                onExternalInsertConsumed={() => setInsertBuf(null)}
                onContentChange={setLiveContent}
                onWikiLink={(t) => void openWikiTarget(t)}
                onSaved={(meta) => {
                  setNote((prev) =>
                    prev ? { ...prev, metadata: meta } : prev
                  );
                  void refreshList();
                }}
              />
            </div>
            <aside className="hidden min-h-0 space-y-3 overflow-auto lg:block">
              <Outline content={liveContent} />
              <BacklinksPanel
                notePath={note.relativePath}
                title={note.metadata.title}
                onOpen={(p) => void openNote(p)}
              />
            </aside>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm opacity-60">
            Sélectionnez ou créez une note
          </div>
        )}
      </main>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        notes={notes.map((n) => ({ path: n.path, title: n.title }))}
        onOpen={(p) => void openNote(p)}
        onCreate={() => setTemplatesOpen(true)}
        onSearchFocus={() => setSearchOpen(true)}
      />
      <SearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onOpen={(p) => void openNote(p)}
      />
      <TasksView
        open={tasksOpen}
        onClose={() => setTasksOpen(false)}
        onOpenNote={(p) => void openNote(p)}
      />
      <SnippetLibrary
        open={snippetsOpen}
        onClose={() => setSnippetsOpen(false)}
        onInsert={(c) => setInsertBuf(c)}
      />
      <TemplatePicker
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onPick={(tpl) => void createNote("_inbox", tpl || undefined)}
      />
    </div>
  );
}

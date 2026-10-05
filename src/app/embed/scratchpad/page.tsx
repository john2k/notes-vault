"use client";

import { useState } from "react";

/**
 * Compact scratchpad for HomeHub / dashboard iframes → quick-capture inbox.
 * Bloc-notes compact pour iframes HomeHub → inbox quick-capture.
 */
export default function ScratchpadPage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      // Token can be injected by HomeHub host page if needed via query later.
      // Le jeton peut être injecté par la page hôte HomeHub si besoin.
      const res = await fetch("/api/quick-capture", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title || "Scratchpad",
          content,
          tags: ["scratchpad"],
        }),
      });
      if (!res.ok) {
        setStatus("Error / Erreur");
        return;
      }
      const data = await res.json();
      setContent("");
      setTitle("");
      setStatus(`Sent to Inbox / Envoyé: ${data.path}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-zinc-900 p-3 text-zinc-100">
      <input
        className="mb-2 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none"
        placeholder="Title / Titre"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="mb-3 min-h-[50vh] flex-1 resize-none rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none"
        placeholder="Write quickly… / Écrivez rapidement…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button
        type="button"
        disabled={busy || (!content.trim() && !title.trim())}
        onClick={() => void send()}
        className="rounded bg-teal-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        Envoyer dans l&apos;Inbox / Send to Inbox
      </button>
      {status ? <p className="mt-2 text-xs text-zinc-400">{status}</p> : null}
    </div>
  );
}

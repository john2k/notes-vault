"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import powershell from "highlight.js/lib/languages/powershell";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Code2, FileText } from "lucide-react";
import type { NoteMetadata } from "@/lib/fs-vault";
import { NOTE_COLORS, cn, colorBorderClass } from "@/lib/utils";

const lowlight = createLowlight(common);
// Explicit PowerShell (.ps1) support for homelab snippets.
// Support PowerShell (.ps1) explicite pour les snippets homelab.
lowlight.register("powershell", powershell);
lowlight.register("ps1", powershell);

type EditorMode = "document" | "raw";

interface EditorProps {
  path: string;
  initialContent: string;
  initialMetadata: NoteMetadata;
  onSaved?: (metadata: NoteMetadata) => void;
}

function markdownToHtml(md: string): string {
  // Minimal markdown → HTML for Tiptap bootstrap (headings, lists, code fences).
  // Conversion minimale markdown → HTML pour amorcer Tiptap.
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withCode = escaped.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    (_m, lang: string | undefined, code: string) =>
      `<pre><code class="language-${lang || "text"}">${code}</code></pre>`
  );

  const lines = withCode.split("\n");
  const html: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("<pre>")) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(line);
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      const level = heading[1].length;
      html.push(`<h${level}>${heading[2]}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+\[([ xX])\]\s+(.*)$/.test(line)) {
      const m = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line)!;
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      const checked = m[1].toLowerCase() === "x";
      html.push(
        `<li data-checked="${checked}"><input type="checkbox" ${checked ? "checked" : ""} disabled /> ${m[2]}</li>`
      );
      continue;
    }
    if (/^[-*]\s+(.*)$/.test(line)) {
      const m = /^[-*]\s+(.*)$/.exec(line)!;
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${m[1]}</li>`);
      continue;
    }
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
    if (!line.trim()) html.push("<p></p>");
    else html.push(`<p>${line}</p>`);
  }
  if (inList) html.push("</ul>");
  return html.join("");
}

function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const parts: string[] = [];

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return;
    }
    if (!(node instanceof HTMLElement)) return;

    const tag = node.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const level = Number(tag[1]);
      parts.push(`${"#".repeat(level)} ${node.textContent || ""}\n\n`);
      return;
    }
    if (tag === "pre") {
      const code = node.querySelector("code");
      const lang =
        [...(code?.classList || [])]
          .find((c) => c.startsWith("language-"))
          ?.replace("language-", "") || "";
      parts.push(`\`\`\`${lang}\n${code?.textContent || node.textContent || ""}\n\`\`\`\n\n`);
      return;
    }
    if (tag === "ul") {
      node.querySelectorAll(":scope > li").forEach((li) => {
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (checkbox) {
          const checked = (checkbox as HTMLInputElement).checked;
          const text = li.textContent || "";
          parts.push(`- [${checked ? "x" : " "}] ${text.trim()}\n`);
        } else {
          parts.push(`- ${li.textContent?.trim() || ""}\n`);
        }
      });
      parts.push("\n");
      return;
    }
    if (tag === "p") {
      parts.push(`${node.textContent || ""}\n\n`);
      return;
    }
    node.childNodes.forEach(walk);
  };

  doc.body.childNodes.forEach(walk);
  return parts.join("").trimEnd() + "\n";
}

export function Editor({
  path,
  initialContent,
  initialMetadata,
  onSaved,
}: EditorProps) {
  const [mode, setMode] = useState<EditorMode>("document");
  const [raw, setRaw] = useState(initialContent);
  const [metadata, setMetadata] = useState(initialMetadata);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ content: initialContent, metadata: initialMetadata });

  useEffect(() => {
    setRaw(initialContent);
    setMetadata(initialMetadata);
    latestRef.current = { content: initialContent, metadata: initialMetadata };
  }, [path, initialContent, initialMetadata]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "bash",
        // Explicit languages: powershell, ini, json, yaml, bash
        // Langages explicites : powershell, ini, json, yaml, bash
        languageClassPrefix: "language-",
      }),
    ],
    []
  );

  const persist = async (content: string, meta: NoteMetadata) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/notes/${path.split("/").map(encodeURIComponent).join("/")}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, metadata: meta }),
      });
      if (res.ok) {
        const data = await res.json();
        setMetadata(data.metadata);
        onSaved?.(data.metadata);
      }
    } finally {
      setSaving(false);
    }
  };

  const scheduleSave = (content: string, meta: NoteMetadata) => {
    latestRef.current = { content, metadata: meta };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Debounce disk writes by 1.5s / Debounce écritures disque 1.5s
    saveTimer.current = setTimeout(() => {
      void persist(content, meta);
    }, 1500);
  };

  const editor = useEditor({
    extensions,
    content: markdownToHtml(initialContent),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-none min-h-[50vh] focus:outline-none px-4 py-3",
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = htmlToMarkdown(ed.getHTML());
      setRaw(md);
      scheduleSave(md, latestRef.current.metadata);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = markdownToHtml(initialContent);
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const updateColor = (color: string) => {
    const next = { ...latestRef.current.metadata, color };
    setMetadata(next);
    scheduleSave(latestRef.current.content, next);
  };

  const copyAllCode = async () => {
    const blocks = Array.from(
      document.querySelectorAll(".ProseMirror pre code")
    )
      .map((n) => n.textContent || "")
      .join("\n\n");
    await navigator.clipboard.writeText(blocks || latestRef.current.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-lg border bg-white shadow-sm border-l-4",
        colorBorderClass(metadata.color)
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-1">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              onClick={() => updateColor(c.id)}
              className={cn(
                "h-5 w-5 rounded-full border-2",
                c.className.replace("border-", "bg-").replace("-500", "-500").replace("-400", "-400"),
                metadata.color === c.id ? "ring-2 ring-offset-1 ring-zinc-800" : ""
              )}
              style={{
                background:
                  c.id === "gray"
                    ? "#a1a1aa"
                    : c.id === "green"
                      ? "#10b981"
                      : c.id === "blue"
                        ? "#0ea5e9"
                        : c.id === "orange"
                          ? "#f97316"
                          : "#ec4899",
              }}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode("document")}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1",
              mode === "document" ? "bg-zinc-900 text-white" : "bg-zinc-100"
            )}
          >
            <FileText className="h-3.5 w-3.5" /> Document
          </button>
          <button
            type="button"
            onClick={() => setMode("raw")}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1",
              mode === "raw" ? "bg-zinc-900 text-white" : "bg-zinc-100"
            )}
          >
            <Code2 className="h-3.5 w-3.5" /> Code brut / Raw
          </button>
          <button
            type="button"
            onClick={() => void copyAllCode()}
            className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-1"
            title="Copy code blocks / Copier les blocs de code"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            Copy
          </button>
          <span className="text-xs text-zinc-500">
            {saving ? "Saving… / Enregistrement…" : "Saved / Sauvé"}
          </span>
        </div>
      </div>

      {mode === "document" ? (
        <div className="relative flex-1 overflow-auto">
          <EditorContent editor={editor} />
          {/* Per-code-block copy buttons */}
          <CodeBlockCopyButtons />
        </div>
      ) : (
        <textarea
          className="flex-1 resize-none bg-zinc-950 p-4 font-mono text-sm text-zinc-100 outline-none"
          value={raw}
          onChange={(e) => {
            const value = e.target.value;
            setRaw(value);
            scheduleSave(value, latestRef.current.metadata);
            editor?.commands.setContent(markdownToHtml(value), {
              emitUpdate: false,
            });
          }}
        />
      )}
    </div>
  );
}

function CodeBlockCopyButtons() {
  useEffect(() => {
    const root = document.querySelector(".ProseMirror");
    if (!root) return;

    const attach = () => {
      root.querySelectorAll("pre").forEach((pre) => {
        if (pre.querySelector("[data-copy-btn]")) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.copyBtn = "1";
        btn.textContent = "Copy";
        btn.className =
          "absolute right-2 top-2 rounded bg-zinc-800 px-2 py-0.5 text-xs text-white";
        pre.classList.add("relative");
        btn.onclick = async () => {
          const code = pre.querySelector("code")?.textContent || "";
          await navigator.clipboard.writeText(code);
          btn.textContent = "OK";
          setTimeout(() => {
            btn.textContent = "Copy";
          }, 1000);
        };
        pre.appendChild(btn);
      });
    };

    attach();
    const mo = new MutationObserver(attach);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  return null;
}

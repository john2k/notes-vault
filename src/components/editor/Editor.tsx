"use client";

import { useEditor, EditorContent, type Editor as TiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import powershell from "highlight.js/lib/languages/powershell";
import ini from "highlight.js/lib/languages/ini";
import yaml from "highlight.js/lib/languages/yaml";
import json from "highlight.js/lib/languages/json";
import bash from "highlight.js/lib/languages/bash";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Check,
  Code2,
  Copy,
  FileText,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
} from "lucide-react";
import type { NoteMetadata } from "@/lib/fs-vault";
import { NOTE_COLORS, cn, getNoteColor } from "@/lib/utils";
import { CODE_LANGUAGES } from "@/components/editor/CodeBlock";

const lowlight = createLowlight(common);

// Homelab languages: powershell (.ps1), ini, json, yaml, bash
// Langages homelab : powershell (.ps1), ini, json, yaml, bash
lowlight.register("powershell", powershell);
lowlight.register("ps1", powershell);
lowlight.register("ini", ini);
lowlight.register("yaml", yaml);
lowlight.register("yml", yaml);
lowlight.register("json", json);
lowlight.register("bash", bash);
lowlight.register("shell", bash);
lowlight.register("sh", bash);

type EditorMode = "document" | "raw";

interface EditorProps {
  path: string;
  initialContent: string;
  initialMetadata: NoteMetadata;
  onSaved?: (metadata: NoteMetadata) => void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inList: "ul" | "ol" | null = null;
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];

  const closeList = () => {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  };

  for (const line of lines) {
    const fence = /^```(\w+)?\s*$/.exec(line);
    if (fence) {
      if (!inCode) {
        closeList();
        inCode = true;
        codeLang = fence[1] || "bash";
        codeBuf = [];
      } else {
        html.push(
          `<pre><code class="language-${codeLang}">${escapeHtml(codeBuf.join("\n"))}</code></pre>`
        );
        inCode = false;
        codeLang = "";
        codeBuf = [];
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }

    if (/^>\s?(.*)$/.test(line)) {
      closeList();
      const m = /^>\s?(.*)$/.exec(line)!;
      html.push(`<blockquote><p>${escapeHtml(m[1])}</p></blockquote>`);
      continue;
    }

    if (/^[-*]\s+\[([ xX])\]\s+(.*)$/.test(line)) {
      const m = /^[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line)!;
      if (inList !== "ul") {
        closeList();
        html.push("<ul>");
        inList = "ul";
      }
      const checked = m[1].toLowerCase() === "x";
      html.push(
        `<li data-checked="${checked}"><label><input type="checkbox" ${checked ? "checked" : ""} disabled /> ${escapeHtml(m[2])}</label></li>`
      );
      continue;
    }

    if (/^[-*]\s+(.*)$/.test(line)) {
      const m = /^[-*]\s+(.*)$/.exec(line)!;
      if (inList !== "ul") {
        closeList();
        html.push("<ul>");
        inList = "ul";
      }
      html.push(`<li>${escapeHtml(m[1])}</li>`);
      continue;
    }

    if (/^\d+\.\s+(.*)$/.test(line)) {
      const m = /^\d+\.\s+(.*)$/.exec(line)!;
      if (inList !== "ol") {
        closeList();
        html.push("<ol>");
        inList = "ol";
      }
      html.push(`<li>${escapeHtml(m[1])}</li>`);
      continue;
    }

    closeList();
    if (!line.trim()) html.push("<p></p>");
    else {
      const withInline = escapeHtml(line)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
      html.push(`<p>${withInline}</p>`);
    }
  }

  if (inCode) {
    html.push(
      `<pre><code class="language-${codeLang || "bash"}">${escapeHtml(codeBuf.join("\n"))}</code></pre>`
    );
  }
  closeList();
  return html.join("");
}

function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const parts: string[] = [];

  const inline = (el: HTMLElement): string => {
    let out = "";
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.textContent || "";
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      const t = node.tagName.toLowerCase();
      if (t === "strong" || t === "b") out += `**${inline(node)}**`;
      else if (t === "em" || t === "i") out += `*${inline(node)}*`;
      else if (t === "code") out += `\`${node.textContent || ""}\``;
      else if (t === "br") out += "\n";
      else out += inline(node);
    });
    return out;
  };

  const walk = (node: Node) => {
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName.toLowerCase();

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      parts.push(`${"#".repeat(Number(tag[1]))} ${inline(node)}\n\n`);
      return;
    }
    if (tag === "pre") {
      const code = node.querySelector("code");
      const lang =
        [...(code?.classList || [])]
          .find((c) => c.startsWith("language-"))
          ?.replace("language-", "") || "bash";
      const text = code?.textContent || node.textContent || "";
      parts.push(`\`\`\`${lang}\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`);
      return;
    }
    if (tag === "blockquote") {
      const text = inline(node).trim();
      parts.push(
        text
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n") + "\n\n"
      );
      return;
    }
    if (tag === "ul" || tag === "ol") {
      let i = 1;
      node.querySelectorAll(":scope > li").forEach((li) => {
        const checkbox = li.querySelector('input[type="checkbox"]');
        const label = li.querySelector("label");
        const text = checkbox
          ? (label?.textContent || li.textContent || "").trim()
          : inline(li as HTMLElement).trim();
        if (checkbox) {
          const checked = (checkbox as HTMLInputElement).checked;
          parts.push(`- [${checked ? "x" : " "}] ${text}\n`);
        } else if (tag === "ol") {
          parts.push(`${i}. ${text}\n`);
          i += 1;
        } else {
          parts.push(`- ${text}\n`);
        }
      });
      parts.push("\n");
      return;
    }
    if (tag === "p") {
      parts.push(`${inline(node)}\n\n`);
      return;
    }
    node.childNodes.forEach(walk);
  };

  doc.body.childNodes.forEach(walk);
  return parts.join("").trimEnd() + "\n";
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border text-stone-700 transition",
        active
          ? "border-teal-700 bg-teal-700 text-white"
          : "border-transparent bg-transparent hover:border-stone-300 hover:bg-white"
      )}
    >
      {children}
    </button>
  );
}

function FormatToolbar({ editor }: { editor: TiptapEditor | null }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-r border-stone-300 pr-2">
      <ToolbarButton
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="H1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="H2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Ordered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Quote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() =>
          editor.chain().focus().toggleCodeBlock({ language: "powershell" }).run()
        }
      >
        <Code2 className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
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
  const [codeLang, setCodeLang] = useState("powershell");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ content: initialContent, metadata: initialMetadata });
  const palette = getNoteColor(metadata.color);

  useEffect(() => {
    setRaw(initialContent);
    setMetadata(initialMetadata);
    latestRef.current = { content: initialContent, metadata: initialMetadata };
  }, [path, initialContent, initialMetadata]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "bash",
        languageClassPrefix: "language-",
      }),
    ],
    []
  );

  const persist = async (content: string, meta: NoteMetadata) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/notes/${path.split("/").map(encodeURIComponent).join("/")}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, metadata: meta }),
        }
      );
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
        class: "ProseMirror max-w-none px-5 py-4",
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
    editor.commands.setContent(markdownToHtml(initialContent), {
      emitUpdate: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const updateColor = (color: string) => {
    const next = { ...latestRef.current.metadata, color };
    setMetadata(next);
    scheduleSave(latestRef.current.content, next);
  };

  const insertCodeBlock = () => {
    editor
      ?.chain()
      .focus()
      .toggleCodeBlock({ language: codeLang })
      .run();
  };

  const setActiveCodeLanguage = (lang: string) => {
    setCodeLang(lang);
    if (editor?.isActive("codeBlock")) {
      editor.chain().focus().updateAttributes("codeBlock", { language: lang }).run();
    }
  };

  const copyAllCode = async () => {
    const blocks = Array.from(document.querySelectorAll(".ProseMirror pre code"))
      .map((n) => n.textContent || "")
      .join("\n\n");
    await navigator.clipboard.writeText(blocks || latestRef.current.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="note-shell flex h-full flex-col overflow-hidden rounded-xl border border-stone-300"
      style={
        {
          "--note-color": palette.solid,
          "--note-wash": palette.wash,
        } as React.CSSProperties
      }
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-[#fffaf3]/70 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5 pr-2">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
            Couleur
          </span>
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              onClick={() => updateColor(c.id)}
              className={cn(
                "h-6 w-6 rounded-full border-2 border-white shadow-sm transition hover:scale-110",
                metadata.color === c.id && "ring-2 ring-offset-2 ring-stone-800"
              )}
              style={{ background: c.solid }}
            />
          ))}
        </div>

        <FormatToolbar editor={editor} />

        <div className="flex items-center gap-1">
          <select
            className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs text-stone-700"
            value={codeLang}
            onChange={(e) => setActiveCodeLanguage(e.target.value)}
            title="Code language / Langage code"
          >
            {CODE_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={insertCodeBlock}
            className="h-8 rounded-md border border-stone-300 bg-white px-2 text-xs text-stone-700 hover:bg-stone-50"
          >
            Insert code
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode("document")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium",
              mode === "document"
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-700 border border-stone-300"
            )}
          >
            <FileText className="h-3.5 w-3.5" /> Document
          </button>
          <button
            type="button"
            onClick={() => setMode("raw")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium",
              mode === "raw"
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-700 border border-stone-300"
            )}
          >
            <Code2 className="h-3.5 w-3.5" /> Code brut
          </button>
          <button
            type="button"
            onClick={() => void copyAllCode()}
            className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Copy
          </button>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              saving
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
            )}
          >
            {saving ? "Saving…" : "Saved"}
          </span>
        </div>
      </div>

      {mode === "document" ? (
        <div className="relative min-h-0 flex-1 overflow-auto">
          <EditorContent editor={editor} />
          <CodeBlockChrome />
        </div>
      ) : (
        <textarea
          className="raw-editor min-h-0 flex-1 resize-none p-4 font-mono text-sm outline-none"
          value={raw}
          spellCheck={false}
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

/** Language badge + one-click copy on every code block */
function CodeBlockChrome() {
  useEffect(() => {
    const root = document.querySelector(".ProseMirror");
    if (!root) return;

    const attach = () => {
      root.querySelectorAll("pre").forEach((pre) => {
        const code = pre.querySelector("code");
        if (!code) return;

        const lang =
          [...code.classList]
            .find((c) => c.startsWith("language-"))
            ?.replace("language-", "") || "code";

        let badge = pre.querySelector(".code-lang-badge") as HTMLElement | null;
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "code-lang-badge";
          pre.appendChild(badge);
        }
        badge.textContent = lang;

        if (!pre.querySelector(".code-copy-btn")) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "code-copy-btn";
          btn.textContent = "Copy";
          btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await navigator.clipboard.writeText(code.textContent || "");
            btn.textContent = "Copied";
            setTimeout(() => {
              btn.textContent = "Copy";
            }, 1000);
          };
          pre.appendChild(btn);
        }
      });
    };

    attach();
    const mo = new MutationObserver(attach);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  return null;
}

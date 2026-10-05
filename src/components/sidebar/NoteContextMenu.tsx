"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronRight,
  Copy,
  Download,
  FolderInput,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";

export type ContextTargetKind = "note" | "folder";

export type VaultContextAction =
  | "rename"
  | "move"
  | "copy"
  | "export-md"
  | "export-html"
  | "export-txt"
  | "export-json"
  | "export-zip"
  | "new-subfolder"
  | "trash";

/** @deprecated use VaultContextAction */
export type NoteContextAction = VaultContextAction;

interface NoteContextMenuProps {
  x: number;
  y: number;
  path: string;
  title: string;
  kind: ContextTargetKind;
  open: boolean;
  onClose: () => void;
  onAction: (action: VaultContextAction, path: string, kind: ContextTargetKind) => void;
}

/**
 * Right-click context menu for notes and folders.
 * Menu contextuel clic droit pour notes et dossiers.
 */
export function NoteContextMenu({
  x,
  y,
  path,
  title,
  kind,
  open,
  onClose,
  onAction,
}: NoteContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setExportOpen(false);
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const run = (action: VaultContextAction) => {
    onAction(action, path, kind);
    onClose();
  };

  const noteItems: Array<{
    id: VaultContextAction;
    label: string;
    icon: React.ReactNode;
    danger?: boolean;
  }> = [
    { id: "rename", label: "Renommer", icon: <Pencil className="h-3.5 w-3.5" /> },
    { id: "move", label: "Déplacer…", icon: <FolderInput className="h-3.5 w-3.5" /> },
    { id: "copy", label: "Dupliquer", icon: <Copy className="h-3.5 w-3.5" /> },
    {
      id: "trash",
      label: "Corbeille",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      danger: true,
    },
  ];

  const folderItems: Array<{
    id: VaultContextAction;
    label: string;
    icon: React.ReactNode;
    danger?: boolean;
  }> = [
    { id: "rename", label: "Renommer", icon: <Pencil className="h-3.5 w-3.5" /> },
    { id: "move", label: "Déplacer…", icon: <FolderInput className="h-3.5 w-3.5" /> },
    {
      id: "new-subfolder",
      label: "Nouveau sous-dossier",
      icon: <FolderPlus className="h-3.5 w-3.5" />,
    },
    { id: "copy", label: "Dupliquer le dossier", icon: <Copy className="h-3.5 w-3.5" /> },
    {
      id: "trash",
      label: "Corbeille",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      danger: true,
    },
  ];

  const items = kind === "folder" ? folderItems : noteItems;

  const exportFormats =
    kind === "folder"
      ? ([{ id: "export-zip" as const, label: "ZIP (.zip)" }] as const)
      : ([
          { id: "export-md" as const, label: "Markdown (.md)" },
          { id: "export-html" as const, label: "HTML (.html)" },
          { id: "export-txt" as const, label: "Texte (.txt)" },
          { id: "export-json" as const, label: "JSON (.json)" },
        ] as const);

  const left = Math.min(x, typeof window !== "undefined" ? window.innerWidth - 220 : x);
  const top = Math.min(y, typeof window !== "undefined" ? window.innerHeight - 280 : y);

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[200px] overflow-visible rounded-md border border-[var(--border)] bg-[var(--panel)] py-1 shadow-xl"
      style={{ left, top }}
      role="menu"
    >
      <div className="border-b border-[var(--border)] px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {kind === "folder" ? "Dossier · " : ""}
        {title}
      </div>

      {items
        .filter((i) => i.id !== "trash")
        .map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--panel-muted)]"
            onClick={() => run(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}

      <div
        className="relative"
        onMouseEnter={() => setExportOpen(true)}
        onMouseLeave={() => setExportOpen(false)}
      >
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--panel-muted)]"
          onClick={() => setExportOpen((v) => !v)}
        >
          <Download className="h-3.5 w-3.5" />
          Exporter
          <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" />
        </button>
        {exportOpen ? (
          <div className="absolute left-full top-0 z-[101] ml-0.5 min-w-[160px] rounded-md border border-[var(--border)] bg-[var(--panel)] py-1 shadow-xl">
            {exportFormats.map((fmt) => (
              <button
                key={fmt.id}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--panel-muted)]"
                onClick={() => run(fmt.id)}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="my-1 border-t border-[var(--border)]" />

      {items
        .filter((i) => i.id === "trash")
        .map((item) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[var(--panel-muted)]"
            onClick={() => run(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
    </div>
  );
}

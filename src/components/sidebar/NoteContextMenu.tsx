"use client";

import { useEffect, useRef } from "react";
import {
  Copy,
  Download,
  FolderInput,
  Pencil,
  Trash2,
} from "lucide-react";

export type NoteContextAction =
  | "rename"
  | "move"
  | "copy"
  | "export"
  | "trash";

interface NoteContextMenuProps {
  x: number;
  y: number;
  path: string;
  title: string;
  open: boolean;
  onClose: () => void;
  onAction: (action: NoteContextAction, path: string) => void;
}

/**
 * Right-click context menu for sidebar notes.
 * Menu contextuel clic droit pour les notes de la sidebar.
 */
export function NoteContextMenu({
  x,
  y,
  path,
  title,
  open,
  onClose,
  onAction,
}: NoteContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
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

  const items: Array<{
    id: NoteContextAction;
    label: string;
    icon: React.ReactNode;
    danger?: boolean;
  }> = [
    { id: "rename", label: "Renommer", icon: <Pencil className="h-3.5 w-3.5" /> },
    { id: "move", label: "Déplacer…", icon: <FolderInput className="h-3.5 w-3.5" /> },
    { id: "copy", label: "Dupliquer", icon: <Copy className="h-3.5 w-3.5" /> },
    { id: "export", label: "Exporter .md", icon: <Download className="h-3.5 w-3.5" /> },
    {
      id: "trash",
      label: "Corbeille",
      icon: <Trash2 className="h-3.5 w-3.5" />,
      danger: true,
    },
  ];

  // Keep menu on screen
  const left = Math.min(x, typeof window !== "undefined" ? window.innerWidth - 200 : x);
  const top = Math.min(y, typeof window !== "undefined" ? window.innerHeight - 220 : y);

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[180px] overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel)] py-1 shadow-xl"
      style={{ left, top }}
      role="menu"
    >
      <div className="border-b border-[var(--border)] px-3 py-1.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {title}
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className={
            item.danger
              ? "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-400 hover:bg-[var(--panel-muted)]"
              : "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--foreground)] hover:bg-[var(--panel-muted)]"
          }
          onClick={() => {
            onAction(item.id, path);
            onClose();
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}

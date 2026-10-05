"use client";

import { useEffect, useState } from "react";

interface Template {
  path: string;
  title: string;
}

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (templatePath: string) => void;
}

export function TemplatePicker({ open, onClose, onPick }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/templates");
      const data = await res.json();
      setTemplates(data.templates || []);
    })();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-sm font-semibold">Templates</h2>
        <button
          type="button"
          className="mb-2 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm hover:bg-[var(--panel-muted)]"
          onClick={() => {
            onPick("");
            onClose();
          }}
        >
          Note vide / Blank
        </button>
        {templates.map((t) => (
          <button
            key={t.path}
            type="button"
            className="mb-1 w-full rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm hover:bg-[var(--panel-muted)]"
            onClick={() => {
              onPick(t.path);
              onClose();
            }}
          >
            {t.title}
          </button>
        ))}
        {templates.length === 0 ? (
          <p className="mt-2 text-xs opacity-60">
            Place des modèles dans <code>vault/_templates/</code>
          </p>
        ) : null}
      </div>
    </div>
  );
}

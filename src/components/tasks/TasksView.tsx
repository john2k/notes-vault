"use client";

import { useEffect, useState } from "react";
import { CheckSquare, Square } from "lucide-react";

interface Task {
  notePath: string;
  line: number;
  text: string;
  done: boolean;
}

interface TasksViewProps {
  open: boolean;
  onClose: () => void;
  onOpenNote: (path: string) => void;
}

export function TasksView({ open, onClose, onOpenNote }: TasksViewProps) {
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setOpenTasks(data.open || []);
      setDoneTasks(data.done || []);
    })();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--panel)] shadow-xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-3">
        <h2 className="text-sm font-semibold">Toutes les tâches</h2>
        <button type="button" className="text-xs opacity-60" onClick={onClose}>
          Fermer
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider opacity-50">
          Ouvertes ({openTasks.length})
        </h3>
        <ul className="mb-4 space-y-1">
          {openTasks.map((t, i) => (
            <li key={`${t.notePath}-${t.line}-${i}`}>
              <button
                type="button"
                onClick={() => onOpenNote(t.notePath)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--panel-muted)]"
              >
                <Square className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {t.text}
                  <span className="mt-0.5 block font-mono text-[10px] opacity-50">
                    {t.notePath}:{t.line}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider opacity-50">
          Terminées ({doneTasks.length})
        </h3>
        <ul className="space-y-1">
          {doneTasks.slice(0, 30).map((t, i) => (
            <li key={`d-${t.notePath}-${t.line}-${i}`}>
              <button
                type="button"
                onClick={() => onOpenNote(t.notePath)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm opacity-60 hover:bg-[var(--panel-muted)]"
              >
                <CheckSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="line-through">{t.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Note border color presets / Pastilles de couleur de bordure */
export const NOTE_COLORS = [
  { id: "gray", label: "Gris / Gray", className: "border-zinc-400" },
  { id: "green", label: "Vert Famille / Family Green", className: "border-emerald-500" },
  { id: "blue", label: "Bleu Travail / Work Blue", className: "border-sky-500" },
  { id: "orange", label: "Orange Urgent / Urgent Orange", className: "border-orange-500" },
  { id: "pink", label: "Rose Perso / Personal Pink", className: "border-pink-500" },
] as const;

export type NoteColorId = (typeof NOTE_COLORS)[number]["id"];

export function colorBorderClass(color?: string): string {
  return (
    NOTE_COLORS.find((c) => c.id === color)?.className ?? "border-zinc-400"
  );
}

/**
 * Optional Bearer auth for HomeHub integrations.
 * Auth Bearer optionnelle pour les intégrations HomeHub.
 */
export function assertApiAuth(request: Request): Response | null {
  const expected = process.env.HOMEHUB_API_TOKEN;
  if (!expected) return null; // Auth disabled when token unset / Auth désactivée sans token

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

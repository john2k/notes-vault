import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Note color palette (border + soft wash).
 * Palette de couleurs de notes (bordure + teinte douce).
 */
export const NOTE_COLORS = [
  {
    id: "gray",
    label: "Gris / Gray",
    hex: "#71717a",
    border: "border-zinc-500",
    ring: "ring-zinc-500",
    wash: "rgba(113, 113, 122, 0.08)",
    solid: "#71717a",
  },
  {
    id: "green",
    label: "Vert Famille / Family Green",
    hex: "#059669",
    border: "border-emerald-600",
    ring: "ring-emerald-600",
    wash: "rgba(5, 150, 105, 0.10)",
    solid: "#059669",
  },
  {
    id: "blue",
    label: "Bleu Travail / Work Blue",
    hex: "#0284c7",
    border: "border-sky-600",
    ring: "ring-sky-600",
    wash: "rgba(2, 132, 199, 0.10)",
    solid: "#0284c7",
  },
  {
    id: "orange",
    label: "Orange Urgent / Urgent Orange",
    hex: "#ea580c",
    border: "border-orange-600",
    ring: "ring-orange-600",
    wash: "rgba(234, 88, 12, 0.10)",
    solid: "#ea580c",
  },
  {
    id: "pink",
    label: "Rose Perso / Personal Pink",
    hex: "#db2777",
    border: "border-pink-600",
    ring: "ring-pink-600",
    wash: "rgba(219, 39, 119, 0.10)",
    solid: "#db2777",
  },
] as const;

export type NoteColorId = (typeof NOTE_COLORS)[number]["id"];

export function getNoteColor(color?: string) {
  return NOTE_COLORS.find((c) => c.id === color) ?? NOTE_COLORS[0];
}

export function colorBorderClass(color?: string): string {
  return getNoteColor(color).border;
}

/**
 * Optional Bearer auth for HomeHub integrations.
 * Auth Bearer optionnelle pour les intégrations HomeHub.
 */
export function assertApiAuth(request: Request): Response | null {
  const expected = process.env.HOMEHUB_API_TOKEN;
  if (!expected) return null;

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

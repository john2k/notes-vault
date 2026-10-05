/**
 * CodeBlock helpers for Tiptap lowlight rendering.
 * Helpers CodeBlock pour le rendu lowlight Tiptap.
 */
export const CODE_LANGUAGES = [
  "powershell",
  "ps1",
  "json",
  "ini",
  "yaml",
  "yml",
  "bash",
  "shell",
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

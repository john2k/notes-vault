/**
 * Supported code languages for Tiptap CodeBlockLowlight.
 * Langages supportés pour les blocs de code Tiptap.
 */
export const CODE_LANGUAGES = [
  "powershell",
  "ps1",
  "bash",
  "shell",
  "json",
  "ini",
  "yaml",
  "yml",
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<string, string> = {
  powershell: "PowerShell",
  ps1: "PowerShell (.ps1)",
  bash: "Bash",
  shell: "Shell",
  json: "JSON",
  ini: "INI",
  yaml: "YAML",
  yml: "YAML",
};

import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { randomUUID } from "crypto";

/** Absolute vault root / Racine absolue du coffre */
export const VAULT_DIR = path.join(process.cwd(), "vault");

export const DEFAULT_FOLDERS = [
  "Travail",
  "Personnel",
  "Journal",
  "_inbox",
  "_trash",
  "_attachments",
  path.join("_attachments", "audio"),
  path.join("_attachments", "images"),
  "_templates",
  "_snippets",
  "_meta",
] as const;

export interface NoteMetadata {
  id: string;
  title: string;
  tags?: string[];
  color?: string;
  pinned?: boolean;
  expires_at?: string | null;
  shared_with?: string[];
  updated_at?: string;
}

export interface NoteRecord {
  metadata: NoteMetadata;
  content: string;
  relativePath: string;
}

/**
 * Ensure default vault folders exist.
 * Garantit l'existence des dossiers vault par défaut.
 */
export async function ensureVaultStructure(): Promise<void> {
  await fs.mkdir(VAULT_DIR, { recursive: true });
  for (const folder of DEFAULT_FOLDERS) {
    await fs.mkdir(path.join(VAULT_DIR, folder), { recursive: true });
  }
}

function assertInsideVault(fullPath: string): void {
  const resolved = path.resolve(fullPath);
  const root = path.resolve(VAULT_DIR);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Path escapes vault root / Chemin hors du coffre");
  }
}

/**
 * Atomic write: temp file then rename to avoid truncated notes on crash.
 * Écriture atomique : fichier temporaire puis rename pour éviter la corruption.
 */
export async function saveNoteAtomic(
  relativePath: string,
  content: string,
  metadata: Partial<NoteMetadata> & { title: string }
): Promise<NoteMetadata> {
  await ensureVaultStructure();

  const normalized = relativePath.replace(/\\/g, "/");
  const fullPath = path.join(VAULT_DIR, normalized);
  assertInsideVault(fullPath);

  const finalMeta: NoteMetadata = {
    id: metadata.id || randomUUID(),
    title: metadata.title,
    tags: metadata.tags ?? [],
    color: metadata.color ?? "gray",
    pinned: metadata.pinned ?? false,
    expires_at: metadata.expires_at ?? null,
    shared_with: metadata.shared_with ?? [],
    updated_at: new Date().toISOString(),
  };

  const fileData = matter.stringify(content, finalMeta);
  const tempPath = `${fullPath}.${Date.now()}.tmp`;

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(tempPath, fileData, "utf-8");
  await fs.rename(tempPath, fullPath);

  return finalMeta;
}

/**
 * Read a note and extract YAML frontmatter + markdown body.
 * Lit une note et extrait le frontmatter YAML + le corps Markdown.
 */
export async function readNote(relativePath: string): Promise<NoteRecord> {
  const normalized = relativePath.replace(/\\/g, "/");
  const fullPath = path.join(VAULT_DIR, normalized);
  assertInsideVault(fullPath);

  const raw = await fs.readFile(fullPath, "utf-8");
  const parsed = matter(raw);

  return {
    relativePath: normalized,
    metadata: {
      id: String(parsed.data.id ?? ""),
      title: String(parsed.data.title ?? path.basename(normalized, ".md")),
      tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
      color: parsed.data.color ? String(parsed.data.color) : "gray",
      pinned: Boolean(parsed.data.pinned),
      expires_at: parsed.data.expires_at ?? null,
      shared_with: Array.isArray(parsed.data.shared_with)
        ? parsed.data.shared_with
        : [],
      updated_at: parsed.data.updated_at
        ? String(parsed.data.updated_at)
        : undefined,
    },
    content: parsed.content,
  };
}

/**
 * Soft-delete: move note into `_trash/` with a timestamped filename.
 * Soft-delete : déplace la note vers `_trash/` avec horodatage.
 */
export async function trashNote(relativePath: string): Promise<string> {
  await ensureVaultStructure();

  const normalized = relativePath.replace(/\\/g, "/");
  const fullPath = path.join(VAULT_DIR, normalized);
  assertInsideVault(fullPath);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.basename(normalized);
  const trashRel = path.posix.join("_trash", `${stamp}__${base}`);
  const trashPath = path.join(VAULT_DIR, trashRel);

  await fs.mkdir(path.dirname(trashPath), { recursive: true });
  await fs.rename(fullPath, trashPath);
  return trashRel.replace(/\\/g, "/");
}

/**
 * Move/rename a note file inside the vault (atomic rename).
 * Déplace/renomme une note dans le vault (rename atomique).
 */
export async function moveNote(
  fromPath: string,
  toPath: string,
  options?: { title?: string }
): Promise<string> {
  await ensureVaultStructure();
  const from = fromPath.replace(/\\/g, "/");
  let to = toPath.replace(/\\/g, "/");
  if (!to.endsWith(".md")) to = `${to}.md`;

  const fromFull = path.join(VAULT_DIR, from);
  const toFull = path.join(VAULT_DIR, to);
  assertInsideVault(fromFull);
  assertInsideVault(toFull);

  if (from === to && !options?.title) return to;

  // Ensure destination doesn't overwrite another note
  try {
    await fs.access(toFull);
    if (from !== to) {
      throw new Error("Destination already exists / Destination déjà existante");
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT" && from !== to) {
      throw err;
    }
  }

  if (options?.title || from !== to) {
    const note = await readNote(from);
    const meta = {
      ...note.metadata,
      title: options?.title ?? note.metadata.title,
    };
    // Write to destination first (atomic), then remove source if different
    await saveNoteAtomic(to, note.content, meta);
    if (from !== to) {
      await fs.unlink(fromFull);
    }
  } else {
    await fs.mkdir(path.dirname(toFull), { recursive: true });
    await fs.rename(fromFull, toFull);
  }

  return to;
}

/**
 * Duplicate a note to a new path.
 * Duplique une note vers un nouveau chemin.
 */
export async function copyNote(
  fromPath: string,
  toPath?: string
): Promise<string> {
  await ensureVaultStructure();
  const from = fromPath.replace(/\\/g, "/");
  const note = await readNote(from);
  const dir = path.posix.dirname(from);
  const base = path.basename(from, ".md");
  const dest =
    toPath?.replace(/\\/g, "/") ||
    `${dir === "." ? "" : `${dir}/`}${base}-copy-${Date.now()}.md`;

  await saveNoteAtomic(dest, note.content, {
    ...note.metadata,
    id: randomUUID(),
    title: `${note.metadata.title} (copie)`,
  });
  return dest;
}

const PROTECTED_FOLDERS = new Set(["_trash", "_attachments"]);

function normalizeFolderPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function assertFolderMutable(folderRel: string): void {
  const top = folderRel.split("/")[0] || folderRel;
  if (PROTECTED_FOLDERS.has(top) || PROTECTED_FOLDERS.has(folderRel)) {
    throw new Error(
      `Dossier système protégé / Protected system folder: ${folderRel}`
    );
  }
}

function slugifySegment(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[<>:"|?*\\]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\/+/g, "-")
    .slice(0, 80);
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error("Nom de dossier invalide / Invalid folder name");
  }
  return cleaned;
}

/** List all vault folders (nested) for move dialogs / Liste tous les dossiers (imbriqués) */
export async function listVaultFolders(): Promise<string[]> {
  await ensureVaultStructure();

  async function walk(dir: string, prefix: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const out: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      if (entry.name === "_attachments" || entry.name === "_trash") continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      out.push(rel.replace(/\\/g, "/"));
      out.push(...(await walk(path.join(dir, entry.name), rel)));
    }
    return out;
  }

  return (await walk(VAULT_DIR, "")).sort((a, b) => a.localeCompare(b));
}

/**
 * Create a folder (and parents) inside the vault.
 * Crée un dossier (et parents) dans le vault.
 */
export async function createFolder(relativePath: string): Promise<string> {
  await ensureVaultStructure();
  const rel = normalizeFolderPath(relativePath);
  if (!rel) throw new Error("Missing folder path");
  assertFolderMutable(rel);
  const segments = rel.split("/").map(slugifySegment);
  const normalized = segments.join("/");
  const full = path.join(VAULT_DIR, normalized);
  assertInsideVault(full);
  await fs.mkdir(full, { recursive: true });
  return normalized;
}

/**
 * Rename or move a folder inside the vault.
 * Renomme ou déplace un dossier dans le vault.
 */
export async function renameFolder(
  fromPath: string,
  toPath: string
): Promise<string> {
  await ensureVaultStructure();
  const from = normalizeFolderPath(fromPath);
  const to = normalizeFolderPath(toPath);
  if (!from || !to) throw new Error("Missing folder path");
  assertFolderMutable(from);
  assertFolderMutable(to);
  if (from === to) return to;
  if (to === from || to.startsWith(`${from}/`)) {
    throw new Error("Cannot move folder into itself / Impossible de déplacer dans soi-même");
  }

  const fromFull = path.join(VAULT_DIR, from);
  const toFull = path.join(VAULT_DIR, to);
  assertInsideVault(fromFull);
  assertInsideVault(toFull);

  try {
    await fs.access(fromFull);
  } catch {
    throw new Error(`Folder not found / Dossier introuvable: ${from}`);
  }
  try {
    await fs.access(toFull);
    throw new Error("Destination already exists / Destination déjà existante");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  await fs.mkdir(path.dirname(toFull), { recursive: true });
  await fs.rename(fromFull, toFull);
  return to;
}

/**
 * Recursively copy a folder tree.
 * Copie récursive d'un arbre de dossiers.
 */
export async function copyFolder(
  fromPath: string,
  toPath?: string
): Promise<string> {
  await ensureVaultStructure();
  const from = normalizeFolderPath(fromPath);
  assertFolderMutable(from);
  const base = path.posix.basename(from);
  const parent = path.posix.dirname(from);
  const dest =
    (toPath && normalizeFolderPath(toPath)) ||
    `${parent === "." ? "" : `${parent}/`}${base}-copy-${Date.now()}`;
  assertFolderMutable(dest);

  const fromFull = path.join(VAULT_DIR, from);
  const toFull = path.join(VAULT_DIR, dest);
  assertInsideVault(fromFull);
  assertInsideVault(toFull);

  async function copyDir(src: string, dst: string) {
    await fs.mkdir(dst, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const s = path.join(src, entry.name);
      const d = path.join(dst, entry.name);
      if (entry.isDirectory()) await copyDir(s, d);
      else await fs.copyFile(s, d);
    }
  }

  try {
    await fs.access(toFull);
    throw new Error("Destination already exists / Destination déjà existante");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  await copyDir(fromFull, toFull);
  return dest;
}

/**
 * Soft-delete a folder into `_trash/`.
 * Soft-delete : déplace le dossier vers `_trash/`.
 */
export async function trashFolder(relativePath: string): Promise<string> {
  await ensureVaultStructure();
  const rel = normalizeFolderPath(relativePath);
  assertFolderMutable(rel);
  const full = path.join(VAULT_DIR, rel);
  assertInsideVault(full);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = path.posix.basename(rel);
  const trashRel = path.posix.join("_trash", `${stamp}__${base}`);
  const trashPath = path.join(VAULT_DIR, trashRel);
  await fs.mkdir(path.dirname(trashPath), { recursive: true });
  await fs.rename(full, trashPath);
  return trashRel.replace(/\\/g, "/");
}

/**
 * Export a note body in the requested format.
 * Exporte une note dans le format demandé.
 */
export type NoteExportFormat = "md" | "html" | "txt" | "json";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToSimpleHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inCode = false;
  let inList = false;

  const flushList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushList();
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        out.push("<pre><code>");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(`${escapeHtml(line)}\n`);
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      out.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      const item = line.replace(/^[-*]\s+/, "");
      out.push(`<li>${inlineMd(item)}</li>`);
      continue;
    }
    flushList();
    if (!line.trim()) {
      out.push("");
      continue;
    }
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  flushList();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}

function inlineMd(s: string): string {
  let t = escapeHtml(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return t;
}

export async function exportNoteContent(
  relativePath: string,
  format: NoteExportFormat
): Promise<{ body: string; contentType: string; filename: string }> {
  const note = await readNote(relativePath);
  const base =
    path.basename(relativePath, ".md").replace(/[^\w.-]+/g, "_") || "note";

  if (format === "md") {
    const raw = [
      "---",
      `id: ${note.metadata.id}`,
      `title: ${JSON.stringify(note.metadata.title)}`,
      `tags: ${JSON.stringify(note.metadata.tags || [])}`,
      `color: ${note.metadata.color || "gray"}`,
      "---",
      "",
      note.content,
    ].join("\n");
    return {
      body: raw,
      contentType: "text/markdown; charset=utf-8",
      filename: `${base}.md`,
    };
  }

  if (format === "txt") {
    const plain = `# ${note.metadata.title}\n\n${note.content}`
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    return {
      body: plain,
      contentType: "text/plain; charset=utf-8",
      filename: `${base}.txt`,
    };
  }

  if (format === "json") {
    return {
      body: JSON.stringify(
        {
          path: note.relativePath,
          metadata: note.metadata,
          content: note.content,
        },
        null,
        2
      ),
      contentType: "application/json; charset=utf-8",
      filename: `${base}.json`,
    };
  }

  // html
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(note.metadata.title)}</title>
<style>
  body{font-family:Georgia,serif;max-width:42rem;margin:2rem auto;padding:0 1rem;line-height:1.65;color:#1a1a1a}
  pre{background:#1e1e1e;color:#d4d4d4;padding:1rem;overflow:auto;border-radius:6px}
  code{font-family:ui-monospace,Consolas,monospace;font-size:.9em}
  a{color:#0078d4}
</style>
</head>
<body>
<h1>${escapeHtml(note.metadata.title)}</h1>
${markdownToSimpleHtml(note.content)}
</body>
</html>`;
  return {
    body: html,
    contentType: "text/html; charset=utf-8",
    filename: `${base}.html`,
  };
}


/**
 * Recursively list markdown (and canvas) files under vault.
 * Liste récursive des fichiers markdown (et canvas) du coffre.
 */
export async function listVaultFiles(
  dir = VAULT_DIR,
  prefix = ""
): Promise<string[]> {
  await ensureVaultStructure();
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_trash" || entry.name === "_attachments") {
        // Still index trash for restore UI later; skip binary attachments tree for md index.
        // On indexe la corbeille; on saute les binaires _attachments pour l'index md.
        if (entry.name === "_attachments") continue;
      }
      out.push(...(await listVaultFiles(full, rel)));
    } else if (entry.isFile() && /\.(md|canvas)$/i.test(entry.name)) {
      out.push(rel.replace(/\\/g, "/"));
    }
  }

  return out;
}

/**
 * Append a capture block into today's inbox markdown file.
 * Ajoute un bloc de capture dans le fichier inbox du jour.
 */
export async function appendQuickCapture(input: {
  title: string;
  content: string;
  tags?: string[];
  url?: string;
}): Promise<string> {
  await ensureVaultStructure();

  const day = new Date().toISOString().slice(0, 10);
  const relativePath = `_inbox/${day}-inbox.md`;
  const fullPath = path.join(VAULT_DIR, relativePath);

  let existing = "";
  try {
    existing = await fs.readFile(fullPath, "utf-8");
  } catch {
    existing = matter.stringify("", {
      id: randomUUID(),
      title: `Inbox ${day}`,
      tags: ["inbox"],
      color: "gray",
      pinned: false,
      updated_at: new Date().toISOString(),
    });
  }

  const block = [
    "",
    `## ${input.title}`,
    "",
    input.url ? `Source: ${input.url}` : null,
    input.tags?.length ? `Tags: ${input.tags.map((t) => `#${t}`).join(" ")}` : null,
    "",
    input.content,
    "",
    "---",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const next = existing.trimEnd() + "\n" + block;
  const tempPath = `${fullPath}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, next, "utf-8");
  await fs.rename(tempPath, fullPath);
  return relativePath;
}

/**
 * Write a binary/media file atomically under vault/_attachments.
 * Écrit un fichier média atomiquement sous vault/_attachments.
 */
export async function saveAttachmentAtomic(
  relativeUnderAttachments: string,
  data: Buffer
): Promise<string> {
  await ensureVaultStructure();
  const relativePath = path.posix.join(
    "_attachments",
    relativeUnderAttachments.replace(/\\/g, "/")
  );
  const fullPath = path.join(VAULT_DIR, relativePath);
  assertInsideVault(fullPath);

  const tempPath = `${fullPath}.${Date.now()}.tmp`;
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(tempPath, data);
  await fs.rename(tempPath, fullPath);
  return relativePath;
}

/**
 * Write JSON atomically (canvas / PDF annotations).
 * Écriture JSON atomique (canvas / annotations PDF).
 */
export async function saveJsonAtomic(
  relativePath: string,
  value: unknown
): Promise<void> {
  await ensureVaultStructure();
  const normalized = relativePath.replace(/\\/g, "/");
  const fullPath = path.join(VAULT_DIR, normalized);
  assertInsideVault(fullPath);
  const tempPath = `${fullPath}.${Date.now()}.tmp`;
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(tempPath, fullPath);
}

export async function readJsonFile<T = unknown>(
  relativePath: string
): Promise<T> {
  const normalized = relativePath.replace(/\\/g, "/");
  const fullPath = path.join(VAULT_DIR, normalized);
  assertInsideVault(fullPath);
  const raw = await fs.readFile(fullPath, "utf-8");
  return JSON.parse(raw) as T;
}

/** List markdown templates under vault/_templates */
export async function listTemplates(): Promise<
  Array<{ path: string; title: string }>
> {
  await ensureVaultStructure();
  const dir = path.join(VAULT_DIR, "_templates");
  try {
    const files = await fs.readdir(dir);
    const out: Array<{ path: string; title: string }> = [];
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const rel = `_templates/${f}`;
      try {
        const note = await readNote(rel);
        out.push({ path: rel, title: note.metadata.title || f });
      } catch {
        out.push({ path: rel, title: f.replace(/\.md$/, "") });
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** List code snippets under vault/_snippets */
export async function listSnippets(): Promise<
  Array<{ path: string; title: string; content: string }>
> {
  await ensureVaultStructure();
  const dir = path.join(VAULT_DIR, "_snippets");
  try {
    const files = await fs.readdir(dir);
    const out: Array<{ path: string; title: string; content: string }> = [];
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const rel = `_snippets/${f}`;
      const note = await readNote(rel);
      out.push({
        path: rel,
        title: note.metadata.title || f.replace(/\.md$/, ""),
        content: note.content,
      });
    }
    return out;
  } catch {
    return [];
  }
}

export interface SmartFolder {
  id: string;
  name: string;
  tag?: string;
  color?: string;
  folder?: string;
}

export async function loadSmartFolders(): Promise<SmartFolder[]> {
  await ensureVaultStructure();
  try {
    const data = await readJsonFile<{ folders?: SmartFolder[] }>(
      "_meta/smart-folders.json"
    );
    return data.folders ?? [];
  } catch {
    return [];
  }
}

export async function saveSmartFolders(folders: SmartFolder[]): Promise<void> {
  await saveJsonAtomic("_meta/smart-folders.json", {
    folders,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Snapshot note content into .data/versions (disposable history, not source of truth).
 * Snapshot dans .data/versions (historique jetable, pas source de vérité).
 */
export async function saveNoteVersion(
  relativePath: string,
  content: string,
  metadata: NoteMetadata
): Promise<string> {
  const dataDir = path.join(process.cwd(), ".data", "versions");
  const safe = relativePath.replace(/[\\/]/g, "__");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(dataDir, safe);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${stamp}.json`);
  await fs.writeFile(
    file,
    JSON.stringify({ relativePath, content, metadata, saved_at: stamp }, null, 2),
    "utf-8"
  );
  return file;
}

export async function listNoteVersions(
  relativePath: string
): Promise<Array<{ id: string; saved_at: string }>> {
  const dataDir = path.join(process.cwd(), ".data", "versions");
  const safe = relativePath.replace(/[\\/]/g, "__");
  const dir = path.join(dataDir, safe);
  try {
    const files = (await fs.readdir(dir))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();
    return files.map((f) => ({
      id: f,
      saved_at: f.replace(/\.json$/, ""),
    }));
  } catch {
    return [];
  }
}

export async function readNoteVersion(
  relativePath: string,
  id: string
): Promise<{ content: string; metadata: NoteMetadata }> {
  const dataDir = path.join(process.cwd(), ".data", "versions");
  const safe = relativePath.replace(/[\\/]/g, "__");
  const file = path.join(dataDir, safe, id);
  const raw = await fs.readFile(file, "utf-8");
  const data = JSON.parse(raw) as {
    content: string;
    metadata: NoteMetadata;
  };
  return { content: data.content, metadata: data.metadata };
}

/** Extract [[wikilinks]] targets from markdown body */
export function extractWikiLinks(content: string): string[] {
  const re = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    out.push(m[1].trim());
  }
  return [...new Set(out)];
}

/** Extract checklist tasks from markdown */
export function extractTasks(
  content: string,
  notePath: string
): Array<{
  notePath: string;
  line: number;
  text: string;
  done: boolean;
}> {
  const lines = content.split("\n");
  const tasks: Array<{
    notePath: string;
    line: number;
    text: string;
    done: boolean;
  }> = [];
  lines.forEach((line, i) => {
    const m = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (m) {
      tasks.push({
        notePath,
        line: i + 1,
        text: m[2].trim(),
        done: m[1].toLowerCase() === "x",
      });
    }
  });
  return tasks;
}


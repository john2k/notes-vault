import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { randomUUID } from "crypto";

/** Absolute vault root / Racine absolue du coffre */
export const VAULT_DIR = path.join(process.cwd(), "vault");

export const DEFAULT_FOLDERS = [
  "Travail",
  "Personnel",
  "_inbox",
  "_trash",
  "_attachments",
  path.join("_attachments", "audio"),
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

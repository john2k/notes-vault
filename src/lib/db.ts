import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  ensureVaultStructure,
  extractWikiLinks,
  listVaultFiles,
  readNote,
  VAULT_DIR,
} from "./fs-vault";

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "notes-index.sqlite");

export interface IndexedNote {
  path: string;
  id: string;
  title: string;
  tags: string;
  color: string;
  pinned: number;
  updated_at: string;
  folder: string;
}

export interface SearchHit {
  path: string;
  title: string;
  snippet: string;
}

type GlobalWithDb = typeof globalThis & {
  __notesVaultDb?: Database.Database;
};

function getDb(): Database.Database {
  const g = globalThis as GlobalWithDb;
  if (g.__notesVaultDb) return g.__notesVaultDb;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Disposable cache schema — never the source of truth.
  // Schéma de cache jetable — jamais la source de vérité.
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      path TEXT PRIMARY KEY,
      id TEXT,
      title TEXT,
      tags TEXT,
      color TEXT,
      pinned INTEGER DEFAULT 0,
      updated_at TEXT,
      folder TEXT,
      body TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
      path UNINDEXED,
      title,
      body,
      tags,
      content='notes',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
      INSERT INTO notes_fts(rowid, path, title, body, tags)
      VALUES (new.rowid, new.path, new.title, new.body, new.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, path, title, body, tags)
      VALUES ('delete', old.rowid, old.path, old.title, old.body, old.tags);
    END;

    CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
      INSERT INTO notes_fts(notes_fts, rowid, path, title, body, tags)
      VALUES ('delete', old.rowid, old.path, old.title, old.body, old.tags);
      INSERT INTO notes_fts(rowid, path, title, body, tags)
      VALUES (new.rowid, new.path, new.title, new.body, new.tags);
    END;

    CREATE TABLE IF NOT EXISTS links (
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      PRIMARY KEY (source, target)
    );
  `);

  g.__notesVaultDb = db;
  return db;
}

/**
 * Rebuild the disposable SQLite index by scanning vault markdown files.
 * Reconstruit l'index SQLite jetable en scannant les fichiers markdown du vault.
 * Never modifies source markdown. / Ne modifie jamais les markdown sources.
 */
export async function rebuildIndex(): Promise<number> {
  await ensureVaultStructure();
  const db = getDb();
  const files = (await listVaultFiles()).filter((f) => f.endsWith(".md"));

  // Triggers keep FTS in sync on DELETE/INSERT.
  // Les triggers maintiennent le FTS synchronisé sur DELETE/INSERT.
  db.prepare("DELETE FROM notes").run();

  const insert = db.prepare(`
    INSERT INTO notes (path, id, title, tags, color, pinned, updated_at, folder, body)
    VALUES (@path, @id, @title, @tags, @color, @pinned, @updated_at, @folder, @body)
  `);

  const tx = db.transaction((rows: Array<Record<string, unknown>>) => {
    for (const row of rows) insert.run(row);
  });

  const rows: Array<Record<string, unknown>> = [];
  for (const relativePath of files) {
    try {
      const note = await readNote(relativePath);
      rows.push({
        path: relativePath,
        id: note.metadata.id,
        title: note.metadata.title,
        tags: (note.metadata.tags ?? []).join(","),
        color: note.metadata.color ?? "gray",
        pinned: note.metadata.pinned ? 1 : 0,
        updated_at: note.metadata.updated_at ?? "",
        folder: path.posix.dirname(relativePath),
        body: note.content,
      });
    } catch {
      // Skip unreadable files during rebuild / Ignore les fichiers illisibles
    }
  }

  tx(rows);

  // Rebuild wikilink index / Reconstruit l'index des wikilinks
  const clearLinks = db.prepare("DELETE FROM links");
  const insertLink = db.prepare(
    "INSERT OR IGNORE INTO links (source, target) VALUES (?, ?)"
  );
  const linkTx = db.transaction(() => {
    clearLinks.run();
    for (const relativePath of files) {
      try {
        const note = rows.find((r) => r.path === relativePath);
        if (!note) continue;
        const body = String(note.body || "");
        for (const target of extractWikiLinks(body)) {
          insertLink.run(relativePath, target);
        }
      } catch {
        // skip
      }
    }
  });
  linkTx();

  return rows.length;
}

export async function upsertNoteInIndex(relativePath: string): Promise<void> {
  if (!relativePath.endsWith(".md")) return;
  const db = getDb();
  try {
    const note = await readNote(relativePath);
    db.prepare(
      `INSERT INTO notes (path, id, title, tags, color, pinned, updated_at, folder, body)
       VALUES (@path, @id, @title, @tags, @color, @pinned, @updated_at, @folder, @body)
       ON CONFLICT(path) DO UPDATE SET
         id=excluded.id,
         title=excluded.title,
         tags=excluded.tags,
         color=excluded.color,
         pinned=excluded.pinned,
         updated_at=excluded.updated_at,
         folder=excluded.folder,
         body=excluded.body`
    ).run({
      path: relativePath,
      id: note.metadata.id,
      title: note.metadata.title,
      tags: (note.metadata.tags ?? []).join(","),
      color: note.metadata.color ?? "gray",
      pinned: note.metadata.pinned ? 1 : 0,
      updated_at: note.metadata.updated_at ?? "",
      folder: path.posix.dirname(relativePath),
      body: note.content,
    });

    db.prepare("DELETE FROM links WHERE source = ?").run(relativePath);
    const insertLink = db.prepare(
      "INSERT OR IGNORE INTO links (source, target) VALUES (?, ?)"
    );
    for (const target of extractWikiLinks(note.content)) {
      insertLink.run(relativePath, target);
    }
  } catch {
    removeNoteFromIndex(relativePath);
  }
}

export function removeNoteFromIndex(relativePath: string): void {
  const db = getDb();
  db.prepare("DELETE FROM notes WHERE path = ?").run(relativePath);
  db.prepare("DELETE FROM links WHERE source = ?").run(relativePath);
}

/** Notes that link to a title or path fragment / Notes qui pointent vers un titre */
export function getBacklinks(targetTitleOrPath: string): Array<{
  path: string;
  title: string;
}> {
  const db = getDb();
  const target = targetTitleOrPath.replace(/\.md$/i, "");
  const rows = db
    .prepare(
      `SELECT DISTINCT n.path, n.title
       FROM links l
       JOIN notes n ON n.path = l.source
       WHERE lower(l.target) = lower(?)
          OR lower(l.target) = lower(?)
          OR lower(n.title) = lower(?)`
    )
    .all(target, path.posix.basename(target), target) as Array<{
    path: string;
    title: string;
  }>;

  // Also match by title of the target note
  const byTitle = db
    .prepare(
      `SELECT DISTINCT n.path, n.title
       FROM links l
       JOIN notes n ON n.path = l.source
       WHERE lower(l.target) IN (
         SELECT lower(title) FROM notes WHERE lower(path) = lower(?) OR lower(title) = lower(?)
       )`
    )
    .all(targetTitleOrPath, target) as Array<{ path: string; title: string }>;

  const map = new Map<string, { path: string; title: string }>();
  for (const r of [...rows, ...byTitle]) map.set(r.path, r);
  return [...map.values()];
}

export function findNotePathByTitle(title: string): string | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT path FROM notes WHERE lower(title) = lower(?) OR lower(path) = lower(?) LIMIT 1`
    )
    .get(title, title.endsWith(".md") ? title : `${title}.md`) as
    | { path: string }
    | undefined;
  return row?.path ?? null;
}

export function getVaultRoot(): string {
  return VAULT_DIR;
}

export function listIndexedNotes(filters?: {
  tag?: string;
  color?: string;
  search?: string;
}): IndexedNote[] {
  const db = getDb();
  let sql = `SELECT path, id, title, tags, color, pinned, updated_at, folder FROM notes WHERE 1=1`;
  const params: unknown[] = [];

  if (filters?.tag) {
    sql += ` AND (',' || tags || ',') LIKE ?`;
    params.push(`%,${filters.tag},%`);
  }
  if (filters?.color) {
    sql += ` AND color = ?`;
    params.push(filters.color);
  }
  if (filters?.search) {
    sql += ` AND path IN (SELECT path FROM notes_fts WHERE notes_fts MATCH ?)`;
    params.push(filters.search);
  }

  sql += ` ORDER BY pinned DESC, updated_at DESC, title ASC`;
  return db.prepare(sql).all(...params) as IndexedNote[];
}

export function searchNotes(query: string, limit = 25): SearchHit[] {
  const db = getDb();
  if (!query.trim()) return [];

  const stmt = db.prepare(`
    SELECT
      notes_fts.path AS path,
      notes.title AS title,
      snippet(notes_fts, 2, '<mark>', '</mark>', '…', 16) AS snippet
    FROM notes_fts
    JOIN notes ON notes.path = notes_fts.path
    WHERE notes_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `);

  try {
    return stmt.all(query, limit) as SearchHit[];
  } catch {
    // Invalid FTS query syntax — return empty rather than 500
    // Syntaxe FTS invalide — retourne vide plutôt qu'une erreur 500
    return [];
  }
}

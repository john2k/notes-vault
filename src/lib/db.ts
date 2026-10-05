import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  ensureVaultStructure,
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
  } catch {
    removeNoteFromIndex(relativePath);
  }
}

export function removeNoteFromIndex(relativePath: string): void {
  getDb().prepare("DELETE FROM notes WHERE path = ?").run(relativePath);
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

export function getVaultRoot(): string {
  return VAULT_DIR;
}

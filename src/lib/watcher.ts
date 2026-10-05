import path from "path";
import chokidar, { type FSWatcher } from "chokidar";
import {
  rebuildIndex,
  removeNoteFromIndex,
  upsertNoteInIndex,
} from "./db";
import { VAULT_DIR, ensureVaultStructure } from "./fs-vault";

type GlobalWithWatcher = typeof globalThis & {
  __notesVaultWatcher?: FSWatcher;
  __notesVaultWatcherReady?: Promise<void>;
};

function toRelative(filePath: string): string {
  return path.relative(VAULT_DIR, filePath).split(path.sep).join("/");
}

/**
 * Start a singleton Chokidar watcher that keeps the disposable SQLite index in sync.
 * Démarre un watcher Chokidar singleton qui maintient l'index SQLite à jour.
 */
export async function ensureVaultWatcher(): Promise<void> {
  const g = globalThis as GlobalWithWatcher;
  if (g.__notesVaultWatcherReady) return g.__notesVaultWatcherReady;

  g.__notesVaultWatcherReady = (async () => {
    await ensureVaultStructure();
    await rebuildIndex();

    if (g.__notesVaultWatcher) return;

    const watcher = chokidar.watch(VAULT_DIR, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      ignored: [
        /(^|[/\\])\../,
        /\.tmp$/i,
        /_attachments/,
      ],
    });

    const onChange = async (filePath: string) => {
      const rel = toRelative(filePath);
      if (!rel.endsWith(".md")) return;
      await upsertNoteInIndex(rel);
    };

    const onUnlink = (filePath: string) => {
      const rel = toRelative(filePath);
      if (!rel.endsWith(".md")) return;
      removeNoteFromIndex(rel);
    };

    watcher.on("add", onChange);
    watcher.on("change", onChange);
    watcher.on("unlink", onUnlink);

    g.__notesVaultWatcher = watcher;
  })();

  return g.__notesVaultWatcherReady;
}

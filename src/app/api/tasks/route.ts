import { listIndexedNotes } from "@/lib/db";
import { extractTasks, readNote } from "@/lib/fs-vault";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tasks — aggregate checkboxes from all notes.
 * GET /api/tasks — agrège les cases à cocher de toutes les notes.
 */
export async function GET(request: Request) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();

  const notes = listIndexedNotes();
  const tasks = [];
  for (const n of notes) {
    try {
      const note = await readNote(n.path);
      tasks.push(...extractTasks(note.content, n.path));
    } catch {
      // skip
    }
  }

  return Response.json({
    open: tasks.filter((t) => !t.done),
    done: tasks.filter((t) => t.done),
    total: tasks.length,
  });
}

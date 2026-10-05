import { NextRequest } from "next/server";
import {
  copyNote,
  listVaultFolders,
  moveNote,
  readNote,
} from "@/lib/fs-vault";
import {
  removeNoteFromIndex,
  upsertNoteInIndex,
} from "@/lib/db";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/notes/actions
 * { action: "rename"|"move"|"copy"|"export", path, title?, folder?, toPath? }
 */
export async function POST(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();

  const body = await request.json();
  const action = String(body.action || "");
  const fromPath = String(body.path || "").replace(/\\/g, "/");
  if (!fromPath) {
    return Response.json({ error: "Missing path" }, { status: 400 });
  }

  try {
    if (action === "rename") {
      const title = String(body.title || "").trim();
      if (!title) {
        return Response.json({ error: "Missing title" }, { status: 400 });
      }
      const dir = fromPath.includes("/")
        ? fromPath.split("/").slice(0, -1).join("/")
        : "";
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "note";
      const toPath = dir ? `${dir}/${slug}.md` : `${slug}.md`;
      // Keep same filename if only title changes and user wants keep path — still update title
      const keepPath = Boolean(body.keepPath);
      const dest = keepPath ? fromPath : toPath;
      const newPath = await moveNote(fromPath, dest, { title });
      if (fromPath !== newPath) removeNoteFromIndex(fromPath);
      await upsertNoteInIndex(newPath);
      return Response.json({ ok: true, path: newPath });
    }

    if (action === "move") {
      const folder = String(body.folder || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
      if (!folder) {
        return Response.json({ error: "Missing folder" }, { status: 400 });
      }
      const base = fromPath.split("/").pop() || "note.md";
      const toPath = `${folder}/${base}`;
      const newPath = await moveNote(fromPath, toPath);
      if (fromPath !== newPath) removeNoteFromIndex(fromPath);
      await upsertNoteInIndex(newPath);
      return Response.json({ ok: true, path: newPath });
    }

    if (action === "copy") {
      const newPath = await copyNote(fromPath, body.toPath);
      await upsertNoteInIndex(newPath);
      return Response.json({ ok: true, path: newPath }, { status: 201 });
    }

    if (action === "export") {
      const note = await readNote(fromPath);
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
      const filename = fromPath.split("/").pop() || "note.md";
      return new Response(raw, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    if (action === "folders") {
      return Response.json({ folders: await listVaultFolders() });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 }
    );
  }
}

/** GET /api/notes/actions?list=folders */
export async function GET(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();
  if (request.nextUrl.searchParams.get("list") === "folders") {
    return Response.json({ folders: await listVaultFolders() });
  }
  return Response.json({
    actions: ["rename", "move", "copy", "export", "trash"],
  });
}

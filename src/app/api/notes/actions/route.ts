import { NextRequest } from "next/server";
import JSZip from "jszip";
import fs from "fs/promises";
import path from "path";
import {
  VAULT_DIR,
  copyFolder,
  copyNote,
  createFolder,
  exportNoteContent,
  listVaultFolders,
  moveNote,
  renameFolder,
  trashFolder,
  type NoteExportFormat,
} from "@/lib/fs-vault";
import { rebuildIndex, removeNoteFromIndex, upsertNoteInIndex } from "@/lib/db";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NOTE_FORMATS = new Set<NoteExportFormat>(["md", "html", "txt", "json"]);

/**
 * POST /api/notes/actions
 * Notes: rename | move | copy | export
 * Folders: rename-folder | move-folder | copy-folder | create-folder | trash-folder | export-folder
 */
export async function POST(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();

  const body = await request.json();
  const action = String(body.action || "");
  const fromPath = String(body.path || "").replace(/\\/g, "/");

  try {
    if (action === "rename") {
      if (!fromPath) {
        return Response.json({ error: "Missing path" }, { status: 400 });
      }
      const title = String(body.title || "").trim();
      if (!title) {
        return Response.json({ error: "Missing title" }, { status: 400 });
      }
      const dir = fromPath.includes("/")
        ? fromPath.split("/").slice(0, -1).join("/")
        : "";
      const slug =
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/gi, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60) || "note";
      const toPath = dir ? `${dir}/${slug}.md` : `${slug}.md`;
      const keepPath = Boolean(body.keepPath);
      const dest = keepPath ? fromPath : toPath;
      const newPath = await moveNote(fromPath, dest, { title });
      if (fromPath !== newPath) removeNoteFromIndex(fromPath);
      await upsertNoteInIndex(newPath);
      return Response.json({ ok: true, path: newPath });
    }

    if (action === "move") {
      if (!fromPath) {
        return Response.json({ error: "Missing path" }, { status: 400 });
      }
      const folder = String(body.folder || "")
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
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
      if (!fromPath) {
        return Response.json({ error: "Missing path" }, { status: 400 });
      }
      const newPath = await copyNote(fromPath, body.toPath);
      await upsertNoteInIndex(newPath);
      return Response.json({ ok: true, path: newPath }, { status: 201 });
    }

    if (action === "export") {
      if (!fromPath) {
        return Response.json({ error: "Missing path" }, { status: 400 });
      }
      const format = String(body.format || "md").toLowerCase() as NoteExportFormat;
      if (!NOTE_FORMATS.has(format)) {
        return Response.json(
          { error: "Invalid format (md|html|txt|json)" },
          { status: 400 }
        );
      }
      const exported = await exportNoteContent(fromPath, format);
      return new Response(exported.body, {
        headers: {
          "Content-Type": exported.contentType,
          "Content-Disposition": `attachment; filename="${exported.filename}"`,
        },
      });
    }

    if (action === "rename-folder") {
      if (!fromPath) {
        return Response.json({ error: "Missing path" }, { status: 400 });
      }
      const name = String(body.name || "").trim();
      if (!name) {
        return Response.json({ error: "Missing name" }, { status: 400 });
      }
      const parent = fromPath.includes("/")
        ? fromPath.split("/").slice(0, -1).join("/")
        : "";
      const toPath = parent ? `${parent}/${name}` : name;
      const newPath = await renameFolder(fromPath, toPath);
      await rebuildIndex();
      return Response.json({ ok: true, path: newPath });
    }

    if (action === "move-folder") {
      if (!fromPath) {
        return Response.json({ error: "Missing path" }, { status: 400 });
      }
      const folder = String(body.folder || "")
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
      // empty folder = vault root
      const base = fromPath.split("/").pop() || fromPath;
      const toPath = folder ? `${folder}/${base}` : base;
      const newPath = await renameFolder(fromPath, toPath);
      await rebuildIndex();
      return Response.json({ ok: true, path: newPath });
    }

    if (action === "copy-folder") {
      if (!fromPath) {
        return Response.json({ error: "Missing path" }, { status: 400 });
      }
      const newPath = await copyFolder(fromPath, body.toPath);
      await rebuildIndex();
      return Response.json({ ok: true, path: newPath }, { status: 201 });
    }

    if (action === "create-folder") {
      const parent = String(body.parent || body.path || "")
        .replace(/\\/g, "/")
        .replace(/^\/+|\/+$/g, "");
      const name = String(body.name || "").trim();
      if (!name) {
        return Response.json({ error: "Missing name" }, { status: 400 });
      }
      const full = parent ? `${parent}/${name}` : name;
      const created = await createFolder(full);
      return Response.json({ ok: true, path: created }, { status: 201 });
    }

    if (action === "trash-folder") {
      if (!fromPath) {
        return Response.json({ error: "Missing path" }, { status: 400 });
      }
      const trashRel = await trashFolder(fromPath);
      await rebuildIndex();
      return Response.json({ ok: true, path: trashRel });
    }

    if (action === "export-folder") {
      if (!fromPath) {
        return Response.json({ error: "Missing path" }, { status: 400 });
      }
      const folderFull = path.join(VAULT_DIR, fromPath);
      const zip = new JSZip();
      await addDirToZip(zip, folderFull, path.posix.basename(fromPath));
      const buf = await zip.generateAsync({ type: "arraybuffer" });
      const safe = path.posix.basename(fromPath).replace(/[^\w.-]+/g, "_");
      return new Response(buf, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${safe}.zip"`,
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

async function addDirToZip(zip: JSZip, dir: string, prefix: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      await addDirToZip(zip, full, rel);
    } else {
      const data = await fs.readFile(full);
      zip.file(rel.replace(/\\/g, "/"), data);
    }
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
    actions: [
      "rename",
      "move",
      "copy",
      "export",
      "trash",
      "rename-folder",
      "move-folder",
      "copy-folder",
      "create-folder",
      "trash-folder",
      "export-folder",
    ],
    exportFormats: ["md", "html", "txt", "json"],
  });
}

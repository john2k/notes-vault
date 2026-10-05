import { NextRequest } from "next/server";
import {
  listNoteVersions,
  readNote,
  readNoteVersion,
  saveNoteAtomic,
  saveNoteVersion,
} from "@/lib/fs-vault";
import { upsertNoteInIndex } from "@/lib/db";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Note version history stored under .data/versions (disposable).
 * Historique sous .data/versions (jetable).
 */
export async function GET(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();
  const relativePath = request.nextUrl.searchParams.get("path");
  if (!relativePath) {
    return Response.json({ error: "Missing path" }, { status: 400 });
  }
  return Response.json({
    path: relativePath,
    versions: await listNoteVersions(relativePath),
  });
}

export async function POST(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();
  const body = await request.json();
  const relativePath = String(body.path || "");
  if (!relativePath) {
    return Response.json({ error: "Missing path" }, { status: 400 });
  }
  const note = await readNote(relativePath);
  const file = await saveNoteVersion(
    relativePath,
    note.content,
    note.metadata
  );
  return Response.json({ ok: true, file }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();
  const body = await request.json();
  const relativePath = String(body.path || "");
  const id = String(body.id || "");
  if (!relativePath || !id) {
    return Response.json({ error: "Missing path/id" }, { status: 400 });
  }
  const version = await readNoteVersion(relativePath, id);
  await saveNoteAtomic(relativePath, version.content, {
    ...version.metadata,
    title: version.metadata.title,
  });
  await upsertNoteInIndex(relativePath);
  return Response.json({ ok: true, path: relativePath });
}

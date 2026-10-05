import { NextRequest } from "next/server";
import {
  readNote,
  saveNoteAtomic,
  trashNote,
} from "@/lib/fs-vault";
import { removeNoteFromIndex, upsertNoteInIndex } from "@/lib/db";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

function joinPath(segments: string[]): string {
  return segments.map(decodeURIComponent).join("/");
}

/**
 * GET /api/notes/[...path] — raw markdown + metadata.
 * GET /api/notes/[...path] — markdown brut + métadonnées.
 */
export async function GET(_request: NextRequest, ctx: Ctx) {
  const denied = assertApiAuth(_request);
  if (denied) return denied;

  await ensureVaultWatcher();
  const relativePath = joinPath((await ctx.params).path);

  try {
    const note = await readNote(relativePath);
    return Response.json(note);
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

/**
 * PUT /api/notes/[...path] — atomic update of content + frontmatter.
 * PUT /api/notes/[...path] — mise à jour atomique contenu + frontmatter.
 */
export async function PUT(request: NextRequest, ctx: Ctx) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  await ensureVaultWatcher();
  const relativePath = joinPath((await ctx.params).path);
  const body = await request.json();

  let existing;
  try {
    existing = await readNote(relativePath);
  } catch {
    existing = null;
  }

  const metadata = await saveNoteAtomic(
    relativePath,
    String(body.content ?? existing?.content ?? ""),
    {
      id: body.metadata?.id || existing?.metadata.id,
      title: body.metadata?.title || existing?.metadata.title || "Untitled",
      tags: body.metadata?.tags ?? existing?.metadata.tags ?? [],
      color: body.metadata?.color ?? existing?.metadata.color ?? "gray",
      pinned: body.metadata?.pinned ?? existing?.metadata.pinned ?? false,
      expires_at:
        body.metadata?.expires_at ?? existing?.metadata.expires_at ?? null,
      shared_with:
        body.metadata?.shared_with ?? existing?.metadata.shared_with ?? [],
    }
  );

  await upsertNoteInIndex(relativePath);
  return Response.json({ path: relativePath, metadata });
}

/**
 * DELETE /api/notes/[...path] — soft-delete into `_trash/`.
 * DELETE /api/notes/[...path] — soft-delete vers `_trash/`.
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  await ensureVaultWatcher();
  const relativePath = joinPath((await ctx.params).path);

  try {
    const trashPath = await trashNote(relativePath);
    removeNoteFromIndex(relativePath);
    await upsertNoteInIndex(trashPath);
    return Response.json({ ok: true, trashPath });
  } catch {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
}

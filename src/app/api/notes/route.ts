import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { listIndexedNotes, upsertNoteInIndex } from "@/lib/db";
import { saveNoteAtomic } from "@/lib/fs-vault";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/notes — list notes from disposable SQLite cache with optional filters.
 * GET /api/notes — liste les notes depuis le cache SQLite avec filtres optionnels.
 */
export async function GET(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  await ensureVaultWatcher();

  const { searchParams } = request.nextUrl;
  const notes = listIndexedNotes({
    tag: searchParams.get("tag") || undefined,
    color: searchParams.get("color") || undefined,
    search: searchParams.get("search") || undefined,
  });

  return Response.json({ notes });
}

/**
 * POST /api/notes — create a new markdown note via atomic write.
 * POST /api/notes — crée une nouvelle note markdown via écriture atomique.
 */
export async function POST(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  await ensureVaultWatcher();

  const body = await request.json();
  const title = String(body.title || "Untitled").trim();
  const folder = String(body.folder || "_inbox").replace(/\\/g, "/");
  const content = String(body.content || "");
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "note";
  const relativePath = `${folder}/${slug}-${Date.now()}.md`.replace(/\/+/g, "/");

  const metadata = await saveNoteAtomic(relativePath, content, {
    id: body.id || randomUUID(),
    title,
    tags: Array.isArray(body.tags) ? body.tags : [],
    color: body.color || "gray",
    pinned: Boolean(body.pinned),
    expires_at: body.expires_at ?? null,
    shared_with: Array.isArray(body.shared_with) ? body.shared_with : [],
  });

  await upsertNoteInIndex(relativePath);

  return Response.json({ path: relativePath, metadata }, { status: 201 });
}

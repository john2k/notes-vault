import { NextRequest } from "next/server";
import { appendQuickCapture } from "@/lib/fs-vault";
import { upsertNoteInIndex } from "@/lib/db";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/quick-capture — append to vault/_inbox/YYYY-MM-DD-inbox.md
 * Requires Bearer HOMEHUB_API_TOKEN when that env var is set.
 * Exige Bearer HOMEHUB_API_TOKEN lorsque la variable est définie.
 */
export async function POST(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  await ensureVaultWatcher();
  const body = await request.json();

  const title = String(body.title || "Capture").trim();
  const content = String(body.content || "").trim();
  if (!content && !title) {
    return Response.json({ error: "Empty capture" }, { status: 400 });
  }

  const path = await appendQuickCapture({
    title,
    content,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
    url: body.url ? String(body.url) : undefined,
  });

  await upsertNoteInIndex(path);
  return Response.json({ ok: true, path }, { status: 201 });
}

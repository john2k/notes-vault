import { NextRequest } from "next/server";
import { readJsonFile, saveJsonAtomic } from "@/lib/fs-vault";
import { assertApiAuth } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Companion annotation JSON for PDFs kept read-only in `_attachments/`.
 * JSON compagnon d'annotations pour PDF en lecture seule dans `_attachments/`.
 */
export async function GET(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  const path = request.nextUrl.searchParams.get("path");
  if (!path || !path.endsWith(".annotations.json")) {
    return Response.json({ error: "Invalid annotations path" }, { status: 400 });
  }

  try {
    const data = await readJsonFile<{ strokes?: unknown[] }>(path);
    return Response.json({ path, strokes: data.strokes ?? [] });
  } catch {
    return Response.json({ path, strokes: [] });
  }
}

export async function PUT(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  const body = await request.json();
  const path = String(body.path || "");
  if (!path.endsWith(".annotations.json")) {
    return Response.json({ error: "Invalid annotations path" }, { status: 400 });
  }

  await saveJsonAtomic(path, {
    strokes: body.strokes ?? [],
    updated_at: new Date().toISOString(),
  });
  return Response.json({ ok: true, path });
}

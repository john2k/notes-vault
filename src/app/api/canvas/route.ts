import { NextRequest } from "next/server";
import { readJsonFile, saveJsonAtomic } from "@/lib/fs-vault";
import { assertApiAuth } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/canvas?path=folder/name.canvas — load canvas JSON from vault.
 * GET /api/canvas?path=... — charge le JSON canvas depuis le vault.
 */
export async function GET(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  const path = request.nextUrl.searchParams.get("path");
  if (!path || !path.endsWith(".canvas")) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const data = await readJsonFile(path);
    return Response.json({ path, data });
  } catch {
    return Response.json({ path, data: null });
  }
}

/**
 * PUT /api/canvas — atomic save of `.canvas` JSON into the vault folder.
 * PUT /api/canvas — sauvegarde atomique du JSON `.canvas` dans le vault.
 */
export async function PUT(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  const body = await request.json();
  const path = String(body.path || "");
  if (!path.endsWith(".canvas")) {
    return Response.json({ error: "Path must end with .canvas" }, { status: 400 });
  }

  await saveJsonAtomic(path, body.data ?? {});
  return Response.json({ ok: true, path });
}

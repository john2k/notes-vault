import { NextRequest } from "next/server";
import { getBacklinks } from "@/lib/db";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/backlinks?path=...|title=...
 */
export async function GET(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();
  const target =
    request.nextUrl.searchParams.get("path") ||
    request.nextUrl.searchParams.get("title") ||
    "";
  if (!target) {
    return Response.json({ error: "Missing path/title" }, { status: 400 });
  }
  return Response.json({ target, backlinks: getBacklinks(target) });
}

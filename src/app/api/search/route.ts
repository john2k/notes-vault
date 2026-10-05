import { NextRequest } from "next/server";
import { searchNotes } from "@/lib/db";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/search?q= — instant FTS5 search with highlighted snippets.
 * GET /api/search?q= — recherche FTS5 instantanée avec extraits surlignés.
 */
export async function GET(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  await ensureVaultWatcher();
  const q = request.nextUrl.searchParams.get("q") || "";
  const hits = searchNotes(q);
  return Response.json({ query: q, hits });
}

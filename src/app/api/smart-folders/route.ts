import { NextRequest } from "next/server";
import {
  loadSmartFolders,
  saveSmartFolders,
  type SmartFolder,
} from "@/lib/fs-vault";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();
  return Response.json({ folders: await loadSmartFolders() });
}

export async function PUT(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();
  const body = await request.json();
  const folders = (body.folders || []) as SmartFolder[];
  await saveSmartFolders(folders);
  return Response.json({ ok: true, folders });
}

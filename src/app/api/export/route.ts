import { NextRequest } from "next/server";
import JSZip from "jszip";
import fs from "fs/promises";
import path from "path";
import { VAULT_DIR, ensureVaultStructure } from "@/lib/fs-vault";
import { assertApiAuth } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function addDir(zip: JSZip, dir: string, prefix: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === "_trash") continue;
      await addDir(zip, full, rel);
    } else {
      const data = await fs.readFile(full);
      zip.file(rel.replace(/\\/g, "/"), data);
    }
  }
}

/**
 * GET /api/export — zip the vault (markdown + attachments).
 */
export async function GET(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultStructure();
  const zip = new JSZip();
  await addDir(zip, VAULT_DIR, "vault");
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new Response(buf, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="notes-vault-export.zip"`,
    },
  });
}

import { NextRequest } from "next/server";
import path from "path";
import fs from "fs/promises";
import { VAULT_DIR } from "@/lib/fs-vault";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * GET /api/attachments/[...path] — serve vault attachment binaries (read-only).
 * GET /api/attachments/[...path] — sert les binaires du vault (lecture seule).
 */
export async function GET(_request: NextRequest, ctx: Ctx) {
  const segments = (await ctx.params).path.map(decodeURIComponent);
  const relativePath = path.posix.join("_attachments", ...segments);
  const fullPath = path.join(VAULT_DIR, relativePath);
  const root = path.resolve(VAULT_DIR);
  if (!path.resolve(fullPath).startsWith(root + path.sep)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const data = await fs.readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const type =
      ext === ".pdf"
        ? "application/pdf"
        : ext === ".webm"
          ? "audio/webm"
          : ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".gif"
                ? "image/gif"
                : ext === ".webp"
                  ? "image/webp"
                  : "application/octet-stream";
    return new Response(data, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

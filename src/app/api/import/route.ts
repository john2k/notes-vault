import { NextRequest } from "next/server";
import path from "path";
import { randomUUID } from "crypto";
import matter from "gray-matter";
import {
  ensureVaultStructure,
  saveNoteAtomic,
  VAULT_DIR,
} from "@/lib/fs-vault";
import { upsertNoteInIndex } from "@/lib/db";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";
import fs from "fs/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/import — import Obsidian-style markdown files into vault.
 * Body: multipart files OR JSON { files: [{ name, content }] }
 */
export async function POST(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;
  await ensureVaultWatcher();
  await ensureVaultStructure();

  const imported: string[] = [];
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    const files = (body.files || []) as Array<{ name: string; content: string }>;
    for (const file of files) {
      const rel = normalizeImportPath(file.name);
      const parsed = matter(file.content);
      await saveNoteAtomic(rel, parsed.content, {
        id: String(parsed.data.id || randomUUID()),
        title: String(
          parsed.data.title || path.basename(rel, ".md")
        ),
        tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
        color: String(parsed.data.color || "gray"),
        pinned: Boolean(parsed.data.pinned),
      });
      await upsertNoteInIndex(rel);
      imported.push(rel);
    }
  } else {
    const form = await request.formData();
    for (const [, value] of form.entries()) {
      if (!(value instanceof File)) continue;
      if (!value.name.endsWith(".md")) continue;
      const text = await value.text();
      const rel = normalizeImportPath(value.name);
      const parsed = matter(text);
      await saveNoteAtomic(rel, parsed.content, {
        id: String(parsed.data.id || randomUUID()),
        title: String(parsed.data.title || path.basename(rel, ".md")),
        tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
        color: String(parsed.data.color || "gray"),
        pinned: Boolean(parsed.data.pinned),
      });
      await upsertNoteInIndex(rel);
      imported.push(rel);
    }
  }

  // Touch vault root to keep structure
  await fs.mkdir(VAULT_DIR, { recursive: true });

  return Response.json({ ok: true, imported }, { status: 201 });
}

function normalizeImportPath(name: string): string {
  const cleaned = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned.includes("..")) throw new Error("Invalid path");
  if (cleaned.endsWith(".md")) return cleaned.startsWith("_") || cleaned.includes("/")
    ? cleaned
    : `_inbox/${cleaned}`;
  return `_inbox/${cleaned}.md`;
}

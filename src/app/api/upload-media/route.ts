import { NextRequest } from "next/server";
import { saveAttachmentAtomic, saveJsonAtomic } from "@/lib/fs-vault";
import { assertApiAuth } from "@/lib/utils";
import { ensureVaultWatcher } from "@/lib/watcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/upload-media — store audio/pdf/canvas payloads under vault/_attachments.
 * POST /api/upload-media — stocke audio/pdf/canvas sous vault/_attachments.
 */
export async function POST(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  await ensureVaultWatcher();

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await request.json();
    const relativePath = String(body.path || "");
    if (!relativePath) {
      return Response.json({ error: "Missing path" }, { status: 400 });
    }
    await saveJsonAtomic(relativePath, body.data);
    return Response.json({ ok: true, path: relativePath });
  }

  const form = await request.formData();
  const file = form.get("file");
  const kind = String(form.get("kind") || "audio");

  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .replace("T", "-")
    .slice(0, 15);

  let relativeUnder: string;
  if (kind === "pdf") {
    const name = file.name.replace(/[^\w.\-]+/g, "_") || `doc-${stamp}.pdf`;
    relativeUnder = name;
  } else if (kind === "image") {
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    relativeUnder = `images/img-${stamp}.${ext}`;
  } else {
    relativeUnder = `audio/audio-${stamp}.webm`;
  }

  const path = await saveAttachmentAtomic(relativeUnder, buffer);
  return Response.json({ ok: true, path }, { status: 201 });
}

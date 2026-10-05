import { NextRequest } from "next/server";
import { assertApiAuth } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai — local Ollama helpers (summarize, tags, translate, rewrite).
 * Falls back with a clear error if OLLAMA_URL is unset / unreachable.
 */
export async function POST(request: NextRequest) {
  const denied = assertApiAuth(request);
  if (denied) return denied;

  const body = await request.json();
  const action = String(body.action || "summarize");
  const text = String(body.text || "").slice(0, 12000);
  const targetLang = String(body.targetLang || "en");

  if (!text.trim()) {
    return Response.json({ error: "Empty text" }, { status: 400 });
  }

  const base = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2";

  const prompts: Record<string, string> = {
    summarize: `Summarize the following note in concise bullet points (FR+EN short). Note:\n\n${text}`,
    tags: `Suggest 3-8 short tags for this note as a JSON array of strings only.\n\n${text}`,
    translate: `Translate the following text to ${targetLang}. Keep markdown structure.\n\n${text}`,
    rewrite: `Rewrite the following note more clearly in the same language. Keep markdown.\n\n${text}`,
    explain_code: `Explain this code briefly for a homelab engineer:\n\n${text}`,
  };

  const prompt = prompts[action] || prompts.summarize;

  try {
    const res = await fetch(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });
    if (!res.ok) {
      return Response.json(
        {
          error: "Ollama request failed",
          status: res.status,
          hint: "Start Ollama locally and set OLLAMA_URL / OLLAMA_MODEL",
        },
        { status: 502 }
      );
    }
    const data = (await res.json()) as { response?: string };
    return Response.json({
      action,
      result: data.response || "",
      model,
    });
  } catch {
    return Response.json(
      {
        error: "Ollama unreachable",
        hint: "Set OLLAMA_URL (default http://127.0.0.1:11434) or install Ollama",
      },
      { status: 503 }
    );
  }
}

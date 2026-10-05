"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Square } from "lucide-react";

interface AudioRecorderProps {
  onUploaded: (vaultPath: string) => void;
}

/**
 * Browser MediaRecorder → POST /api/upload-media → vault/_attachments/audio/
 * Enregistreur navigateur → upload → coffre audio.
 */
export function AudioRecorder({ onUploaded }: AudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      stopTimer();
      setBusy(true);
      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const form = new FormData();
        form.append("file", blob, "recording.webm");
        form.append("kind", "audio");
        const res = await fetch("/api/upload-media", { method: "POST", body: form });
        const data = await res.json();
        if (data.path) onUploaded(data.path);
      } finally {
        setBusy(false);
        setRecording(false);
        setPaused(false);
        setSeconds(0);
        stream.getTracks().forEach((t) => t.stop());
      }
    };
    mediaRef.current = recorder;
    recorder.start(250);
    setRecording(true);
    setPaused(false);
    setSeconds(0);
    startTimer();
  };

  const pause = () => {
    const rec = mediaRef.current;
    if (!rec) return;
    if (rec.state === "recording") {
      rec.pause();
      setPaused(true);
      stopTimer();
    } else if (rec.state === "paused") {
      rec.resume();
      setPaused(false);
      startTimer();
    }
  };

  const stop = () => {
    mediaRef.current?.stop();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="inline-flex items-center gap-2 rounded-md border bg-white px-2 py-1 text-sm">
      {!recording ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void start()}
          className="inline-flex items-center gap-1 rounded bg-rose-600 px-2 py-1 text-white"
        >
          <Mic className="h-3.5 w-3.5" />
          Record / Enregistrer
        </button>
      ) : (
        <>
          <span className="font-mono text-xs tabular-nums text-rose-700">
            {mm}:{ss}
          </span>
          <button
            type="button"
            onClick={pause}
            className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-1"
          >
            <Pause className="h-3.5 w-3.5" />
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={stop}
            className="inline-flex items-center gap-1 rounded bg-zinc-900 px-2 py-1 text-white"
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>
        </>
      )}
    </div>
  );
}

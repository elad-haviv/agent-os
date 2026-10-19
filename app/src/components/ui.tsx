"use client";
import { useEffect, useState } from "react";

export const COLUMNS: [string, string][] = [
  ["new", "חדשה"],
  ["awaiting_understanding", "ממתין לאישור הבנה"],
  ["in_progress", "בביצוע"],
  ["awaiting_feedback", "ממתין למשוב"],
  ["fixing", "בתיקון"],
  ["done", "הושלם"],
  ["blocked", "חסום / בוטל"],
];

export function statusLabel(s: string) { return COLUMNS.find(c => c[0] === s)?.[1] ?? s; }

export function Light({ v }: { v?: string }) {
  return <span className={`light ${v && v !== "none" ? v : "none"}`} title={v ?? "none"} />;
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="infotip" tabIndex={0}>
      ⓘ<span className="infotip-text" role="tooltip">{text}</span>
    </span>
  );
}

export function age(ts?: string | null) {
  if (!ts) return "";
  const days = Math.floor((Date.now() - new Date(ts.replace(" ", "T") + "Z").getTime()) / 86400000);
  return days <= 0 ? "היום" : `${days} ימים`;
}

export function useApi<T>(url: string | null): { data: T | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let live = true;
    fetch(url).then(r => r.json()).then(d => { if (live) setData(d); }).catch(() => {});
    return () => { live = false; };
  }, [url, tick]);
  return { data, reload: () => setTick(t => t + 1) };
}

export async function api(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? r.statusText);
  return j;
}

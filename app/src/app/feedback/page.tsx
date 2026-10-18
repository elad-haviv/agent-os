"use client";
import { useApi, Light } from "@/components/ui";
import { FeedbackForm } from "@/components/feedback-form";
import Link from "next/link";
import { useState } from "react";

// תור המשוב — ריצות שהסתיימו, אחת אחרי השנייה, מותאם לנייד
export default function FeedbackQueue() {
  const { data, reload } = useApi<{ queue: Record<string, any>[] }>("/api/feedback?pending=1");
  const [i, setI] = useState(0);
  const queue = data?.queue ?? [];
  const run = queue[i];

  if (!queue.length) return <><h1>תור משוב</h1><div className="card muted">אין ריצות הממתינות למשוב. 🎉</div></>;

  return (
    <>
      <h1>תור משוב <span className="muted">{i + 1} מתוך {queue.length}</span></h1>
      <div className="card">
        <div className="muted">{run.project_name ?? "כללי"}</div>
        <h2 style={{ color: "var(--text)" }}><Link href={`/tasks/${run.task_id}`}>{run.task_title}</Link></h2>
        <div className="muted">מודל: {run.model} · טוקנים: {(run.input_tokens + run.output_tokens).toLocaleString()} · עלות: ${run.cost_usd?.toFixed?.(3) ?? run.cost_usd} · צעדים: {run.steps}</div>
        {run.log && <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "var(--panel2)", padding: 10, borderRadius: 8, maxHeight: 200, overflow: "auto" }}>{run.log}</pre>}
        <FeedbackForm runId={run.id} onDone={() => { setI(v => v); reload(); if (i < queue.length - 1) setI(i + 1); else setI(0); }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="ghost" onClick={() => setI(Math.max(0, i - 1))}>← קודם</button>
        <button className="ghost" onClick={() => setI(Math.min(queue.length - 1, i + 1))}>הבא →</button>
      </div>
    </>
  );
}

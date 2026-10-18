"use client";
import { use } from "react";
import { useApi, api, age, statusLabel, Light } from "@/components/ui";
import { FeedbackForm } from "@/components/feedback-form";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: tt, reload } = useApi<{ tasks: Record<string, any>[] }>(`/api/tasks`);
  const { data: rr, reload: rReload } = useApi<{ runs: Record<string, any>[] }>(`/api/runs?taskId=${id}`);
  const task = (tt?.tasks ?? []).find(t => t.id === id);
  const runs = rr?.runs ?? [];
  const [outcome, setOutcome] = useState<string[]>([]);

  useEffect(() => { if (task) setOutcome(task.required_outcome ?? []); }, [task?.id]);

  if (tt && !task) return <div className="card">משימה לא נמצאה. <Link href="/">חזרה</Link></div>;
  if (!task) return null;

  const openRun = runs.find(r => r.status === "running");
  const lastWithFeedback = [...runs].reverse().find(r => r.execution_light && r.execution_light !== "none");

  async function saveOutcome(next: string[]) {
    setOutcome(next);
    await api("/api/tasks", "PATCH", { id, required_outcome: next });
    reload();
  }

  return (
    <>
      <h1>{task.title}</h1>
      <div className="muted" style={{ marginBottom: 14 }}>
        {task.project_name ?? "כללי"} · {statusLabel(task.status)} · {task.run_count} ריצות · ${Number(task.total_cost ?? 0).toFixed(2)} · נוצרה {age(task.created_at)}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>הבנת הסוכן</h2>
        {task.understanding ? (
          <>
            <p>{task.understanding}</p>
            {!task.understanding_approved && (
              <button onClick={async () => { await api("/api/tasks", "PATCH", { id, understanding_approved: 1 }); reload(); }}>אשר הבנה והישג נדרש ✓</button>
            )}
            {task.understanding_approved && <div className="muted" style={{ color: "var(--green)" }}>הבנה מאושרת ✓</div>}
          </>
        ) : <div className="muted">הסוכן טרם ניסח את הבנתו.</div>}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>הישג נדרש (קריטריונים)</h2>
        {outcome.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", margin: "4px 0" }}>
            <input value={c} onChange={e => { const n = [...outcome]; n[i] = e.target.value; setOutcome(n); }} style={{ flex: 1 }} />
            <button className="ghost" onClick={() => saveOutcome(outcome.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="ghost" onClick={() => saveOutcome([...outcome, ""])}>+ קריטריון</button>
        <button onClick={() => saveOutcome(outcome)} style={{ marginRight: 8 }}>שמור</button>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>ציר זמן ריצות</h2>
        {runs.length === 0 && <div className="muted">אין ריצות עדיין.</div>}
        {runs.map(r => (
          <div key={r.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <b>{r.agent_kind === "sub" ? `משנה: ${r.agent_name}` : "ראשי"}</b>
              <span className="chip">{r.model}</span>
              <span className="chip">{r.status === "running" ? "רץ כעת" : `הסתיים ${age(r.ended_at)}`}</span>
              <span className="chip">{r.steps} צעדים</span>
              <span className="chip">${Number(r.cost_usd ?? 0).toFixed(3)}</span>
              <Light v={r.understanding_light} /> <span className="muted">הבנה</span>
              <Light v={r.execution_light} /> <span className="muted">ביצוע</span>
              {r.needs_fix ? <span className="badge high">דרוש תיקון</span> : null}
            </div>
            {r.log && <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "var(--panel2)", padding: 8, borderRadius: 8, marginTop: 8, maxHeight: 160, overflow: "auto" }}>{r.log}</pre>}
            {r.artifacts && <div className="muted">תוצרים: {String(r.artifacts).split(",").filter(Boolean).map((a, i) => <a key={i} href={a} style={{ color: "var(--accent)" }}>{a}</a>)}</div>}
          </div>
        ))}
      </div>

      {openRun && <div className="card muted">ריצה בתהליך — המשוב יהיה זמין כשתסתיים.</div>}

      {lastWithFeedback && !runs.some(r => r.status === "running") && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>טופס משוב — ריצה אחרונה</h2>
          <FeedbackForm runId={lastWithFeedback.id} onDone={() => { reload(); rReload(); }} />
        </div>
      )}
    </>
  );
}

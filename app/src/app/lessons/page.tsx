"use client";
import { useApi, api } from "@/components/ui";
import { useState } from "react";

const SCOPE_LABEL: Record<string, string> = { global: "גלובלי", project: "פרויקט", "task-type": "סוג משימה" };
const STATUS_LABEL: Record<string, string> = { proposed: "מוצע", approved: "מאושר", retired: "בוטל" };

export default function Lessons() {
  const { data, reload } = useApi<{ lessons: Record<string, any>[] }>("/api/lessons");
  const [tab, setTab] = useState<"approved" | "proposed" | "retired">("approved");
  const lessons = (data?.lessons ?? []).filter(l => l.status === tab);

  async function act(id: string, status?: string, mergeInto?: string) {
    await api("/api/lessons", "PATCH", mergeInto ? { id, mergeInto } : { id, status });
    reload();
  }

  return (
    <>
      <h1>ספר הסטנדרטים</h1>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {(["approved", "proposed", "retired"] as const).map(t => (
          <button key={t} className={tab === t ? "" : "ghost"} onClick={() => setTab(t)}>
            {t === "approved" ? "מאושרים" : t === "proposed" ? "ממתינים לאישור" : "בוטלו"}
          </button>
        ))}
      </div>
      <div className="grid cols3">
        {lessons.map(l => (
          <div className="card" key={l.id}>
            <div className="muted">{SCOPE_LABEL[l.scope]}{l.scope_ref ? ` · ${l.scope_ref}` : ""} · {STATUS_LABEL[l.status]} · הופעל {l.applied_count} פעמים</div>
            <p style={{ margin: "8px 0" }}>{l.rule}</p>
            {l.conflict_with && <div className="muted" style={{ color: "var(--yellow)" }}>⚠️ מסומן כסותר עם לקח אחר — דרושת הכרעה</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {l.status === "proposed" && <>
                <button onClick={() => act(l.id, "approved")}>אשר</button>
                <button className="ghost" onClick={() => { const t = prompt("עריכת הכלל:", l.rule); if (t) { api("/api/lessons", "PATCH", { id: l.id, rule: t, status: "approved" }).then(reload); } }}>ערוך ואשר</button>
                <button className="ghost" onClick={() => act(l.id, "retired")}>דחה</button>
              </>}
              {l.status === "approved" && l.conflict_with && <button className="ghost" onClick={() => act(l.id, undefined, l.conflict_with)}>אחד לתוך הלקח הסותר</button>}
              {l.status === "approved" && <button className="ghost" onClick={() => act(l.id, "retired")}>בטל</button>}
            </div>
          </div>
        ))}
        {!lessons.length && <div className="card muted">אין לקחים בסטטוס זה.</div>}
      </div>
    </>
  );
}

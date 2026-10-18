"use client";
import { useApi, api, age } from "@/components/ui";
import Link from "next/link";

type Task = Record<string, any>;

export function Kanban({ tasks }: { tasks: Task[] }) {
  return (
    <div className="kanban">
      {[["new", "חדשה"], ["awaiting_understanding", "ממתין לאישור הבנה"], ["in_progress", "בביצוע"], ["awaiting_feedback", "ממתין למשוב"], ["fixing", "בתיקון"], ["done", "הושלם"], ["blocked", "חסום / בוטל"]].map(([key, label]) => (
        <div className="col" key={key}>
          <h3>{label} ({tasks.filter(t => t.status === key).length})</h3>
          {tasks.filter(t => t.status === key).map(t => (
            <div className="tcard" key={t.id}>
              <Link href={`/tasks/${t.id}`}><b>{t.title}</b></Link>
              <div className="row">
                <span className={`badge ${t.priority === 1 ? "high" : t.priority === 3 ? "low" : "med"}`}>{["", "דחוף", "רגיל", "נמוך"][t.priority] ?? ""}</span>
                <span className="chip">🔄 {t.run_count} ריצות</span>
                <span className="chip">${Number(t.total_cost ?? 0).toFixed(2)}</span>
                <span className="chip">🕐 {age(t.created_at)}</span>
              </div>
              {t.understanding && !t.understanding_approved && (
                <div className="muted" style={{ marginTop: 6 }}>{String(t.understanding).slice(0, 120)}… <ApproveBtn id={t.id} /></div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ApproveBtn({ id }: { id: string }) {
  const { reload } = useApi("/api/tasks");
  return <button className="ghost" onClick={async e => { e.preventDefault(); await api("/api/tasks", "PATCH", { id, understanding_approved: 1 }); reload(); }}>אשר הבנה ✓</button>;
}

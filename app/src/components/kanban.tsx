"use client";
import { useApi, api, age, InfoTip } from "@/components/ui";
import Link from "next/link";

type Task = Record<string, any>;

const COLS: [string, string, string?][] = [
  ["new", "חדשה"],
  ["awaiting_understanding", "ממתין לאישור הבנה", "הסוכן כתב את הבנתו למשימה — קרא ואשר לפני שהוא מתחיל לעבוד."],
  ["in_progress", "בביצוע", "הסוכן עובד על המשימה כרגע."],
  ["awaiting_feedback", "ממתין למשוב", "הסוכן סיים — דרוש חוות דעת שלך כדי לסגור את המשימה."],
  ["fixing", "בתיקון", "המשוב שלך הוביל לריצת תיקון חדשה."],
  ["done", "הושלם"],
  ["blocked", "חסום / בוטל"],
];

export function Kanban({ tasks }: { tasks: Task[] }) {
  return (
    <div className="kanban">
      {COLS.map(([key, label, tip]) => (
        <div className="col" key={key}>
          <h3>{label} ({tasks.filter(t => t.status === key).length}){tip && <InfoTip text={tip} />}</h3>
          {tasks.filter(t => t.status === key).map(t => (
            <div className="tcard" key={t.id}>
              <Link href={`/tasks/${t.id}`}><b>{t.title}</b></Link>
              <div className="row">
                <span className={`badge ${t.priority === 1 ? "high" : t.priority === 3 ? "low" : "med"}`}>{["", "דחוף", "רגיל", "נמוך"][t.priority] ?? ""}</span>
                <span className="chip" title="מספר ריצות הביצוע של הסוכן על משימה זו. תיקון = ריצה חדשה.">🔄 {t.run_count} ריצות</span>
                <span className="chip">${Number(t.total_cost ?? 0).toFixed(2)}</span>
                <span className="chip" title="מתי המשימה נוצרה">🕐 {age(t.created_at)}</span>
              </div>
              {t.understanding && !t.understanding_approved && (
                <div className="muted" style={{ marginTop: 8 }}>{String(t.understanding).slice(0, 120)}… <ApproveBtn id={t.id} /></div>
              )}
            </div>
          ))}
          {!tasks.filter(t => t.status === key).length && (
            <div className="muted" style={{ fontSize: 14, padding: "4px 0" }}>אין משימות בסטטוס זה.</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ApproveBtn({ id }: { id: string }) {
  const { reload } = useApi("/api/tasks");
  return <button className="ghost" onClick={async e => { e.preventDefault(); await api("/api/tasks", "PATCH", { id, understanding_approved: 1 }); reload(); }}>אשר הבנה ✓</button>;
}

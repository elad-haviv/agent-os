"use client";
import { useApi, api, age, InfoTip, statusLabel } from "@/components/ui";
import Link from "next/link";
import { useState } from "react";

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

const PRI_LABEL: Record<number, string> = { 1: "דחוף", 2: "רגיל", 3: "נמוך" };
const SORTS: [string, string][] = [
  ["priority", "עדיפות"],
  ["created", "חדשות קודם"],
  ["cost", "עלות"],
];

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [sort, setSort] = useState("priority");
  const [statusFilter, setStatusFilter] = useState<string>("");

  let shown = [...tasks];
  if (statusFilter) shown = shown.filter(t => t.status === statusFilter);
  shown.sort((a, b) =>
    sort === "priority" ? (a.priority ?? 2) - (b.priority ?? 2)
    : sort === "cost" ? (b.total_cost ?? 0) - (a.total_cost ?? 0)
    : String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));

  return (
    <div>
      <div className="board-toolbar">
        <div className="view-switch">
          <button className={view === "kanban" ? "" : "ghost"} onClick={() => setView("kanban")}>לוח</button>
          <button className={view === "table" ? "" : "ghost"} onClick={() => setView("table")}>טבלה</button>
        </div>
        <label className="muted" style={{ fontSize: 14 }}>מיון:
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ marginRight: 6 }}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="muted" style={{ fontSize: 14 }}>סטטוס:
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ marginRight: 6 }}>
            <option value="">הכל</option>
            {COLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <span className="muted" style={{ fontSize: 14, marginInlineStart: "auto" }}>{shown.length} משימות</span>
      </div>

      {view === "kanban" ? (
        <div className="kanban">
          {COLS.map(([key, label, tip]) => {
            const list = shown.filter(t => t.status === key);
            return (
              <div className="col" key={key}>
                <h3>{label} ({list.length}){tip && <InfoTip text={tip} />}</h3>
                {list.map(t => <CompactCard t={t} key={t.id} />)}
                {!list.length && <div className="muted" style={{ fontSize: 14, padding: "2px 0" }}>—</div>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "auto" }}>
          <table>
            <thead><tr><th>משימה</th><th>סטטוס</th><th>עדיפות</th><th>ריצות</th><th>עלות</th><th>גיל</th></tr></thead>
            <tbody>
              {shown.map(t => (
                <tr key={t.id}>
                  <td><Link href={`/tasks/${t.id}`}>{t.title}</Link></td>
                  <td><span className="chip">{statusLabel(t.status)}</span></td>
                  <td><span className={`badge ${t.priority === 1 ? "high" : t.priority === 3 ? "low" : "med"}`}>{PRI_LABEL[t.priority] ?? "רגיל"}</span></td>
                  <td>{t.run_count}</td>
                  <td>${Number(t.total_cost ?? 0).toFixed(2)}</td>
                  <td className="muted">{age(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!shown.length && <div className="muted" style={{ padding: 16 }}>אין משימות להצגה.</div>}
        </div>
      )}
    </div>
  );
}

function CompactCard({ t }: { t: Task }) {
  return (
    <div className="tcard compact">
      <Link href={`/tasks/${t.id}`} className="tcard-title">{t.title}</Link>
      <div className="row">
        <span className={`badge ${t.priority === 1 ? "high" : t.priority === 3 ? "low" : "med"}`} title={`עדיפות: ${PRI_LABEL[t.priority] ?? "רגיל"}`}>{PRI_LABEL[t.priority] ?? "רגיל"}</span>
        <span className="chip" title="מספר ריצות הביצוע. תיקון = ריצה חדשה.">🔄 {t.run_count}</span>
        <span className="chip" title="עלות מצטברת של הריצות במשימה">${Number(t.total_cost ?? 0).toFixed(2)}</span>
        {t.understanding && !t.understanding_approved && <span className="chip warn" title="ממתין לאישור הבנה שלך">ממתין לאישור</span>}
        <span className="chip muted-chip" title="מתי המשימה נוצרה">{age(t.created_at)}</span>
      </div>
    </div>
  );
}

// Backward-compatible export for existing pages.
export function Kanban({ tasks }: { tasks: Task[] }) {
  return <TaskBoard tasks={tasks} />;
}

"use client";
import { useApi, api, InfoTip, SearchSelect } from "@/components/ui";
import { TaskBoard } from "@/components/kanban";
import Link from "next/link";
import { useState } from "react";

type Task = Record<string, any>;
type Project = { id: string; name: string; slug: string };

export default function Dashboard() {
  const { data: tasks, reload } = useApi<{ tasks: Task[] }>("/api/tasks");
  const { data: projects } = useApi<{ projects: Project[] }>("/api/projects");
  const { data: stats } = useApi<Record<string, any>>("/api/stats");
  const [unified, setUnified] = useState(false);
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [showMap, setShowMap] = useState(false);

  async function createTask() {
    if (!title.trim()) return;
    await api("/api/tasks", "POST", { title, projectId: projectId || null, origin: "app" });
    setTitle(""); reload();
  }

  const all = tasks?.tasks ?? [];
  const active = all.filter(t => !["done", "blocked"].includes(t.status));
  const awaitingFeedback = all.filter(t => t.status === "awaiting_feedback");
  const budget = stats?.costTotalUsd ?? 0;

  return (
    <>
      {/* מפת Pelago כרקע מטושטש — נשלטת מכפתור המפה בסרגל העליון */}
      <div className="map-bg" aria-hidden="true">
        <iframe src="/pelago-map" title="Pelago background map" tabIndex={-1} />
      </div>

      <h1>לוח מחוונים</h1>

      {/* משימה חדשה — הפעולה הראשית, בראש העמוד */}
      <form className="inline" onSubmit={e => { e.preventDefault(); createTask(); }} style={{ marginBottom: 20 }}>
        <input placeholder="משימה חדשה…" value={title} onChange={e => setTitle(e.target.value)} style={{ minWidth: 260 }} />
        <SearchSelect
          value={projectId}
          onChange={setProjectId}
          placeholder="פרויקט: כללי"
          options={(projects?.projects ?? []).map(p => ({ value: p.id, label: p.name }))}
        />
        <button>הוסף</button>
      </form>

      <div className="grid cols4">
        <div className="card"><span className="muted">משימות פעילות</span><div className="kpi">{active.length}</div></div>
        <div className="card">
          <span className="muted">
            <Link href="/feedback">ממתין למשוב</Link>
            <InfoTip text="משימות שהסוכן סיים והוא ממתין לחוות דעתך עליהן." />
          </span>
          <div className="kpi" style={{ color: awaitingFeedback.length > 0 ? "var(--yellow)" : undefined }}>
            {awaitingFeedback.length}
          </div>
        </div>
        <div className="card"><span className="muted">עלות החודש</span><div className="kpi">${Number(budget).toFixed(2)} <small>/ $50</small></div>
          <div style={{ background: "var(--panel2)", height: 6, borderRadius: 3, marginTop: 8 }}>
            <div style={{ width: `${Math.min(100, budget / 50 * 100)}%`, height: 6, borderRadius: 3, background: budget > 40 ? "var(--red)" : "var(--accent)" }} />
          </div></div>
        <div className="card">
          <span className="muted">לקחים מאושרים<InfoTip text="כללים שנלמדו מהמשוב שלך ואושרו. הם מוזרקים אוטומטית לפני משימות דומות." /></span>
          <div className="kpi">{stats?.lessonsApproved ?? 0} <small>+{stats?.lessonsProposed ?? 0} מוצעים</small></div>
        </div>
      </div>

      <h2>משימות</h2>
      <label className="muted" style={{ display: "block", marginBottom: 10 }}>
        <input type="checkbox" checked={unified} onChange={e => setUnified(e.target.checked)} /> לוח מאוחד לכל הפרויקטים
      </label>

      {!tasks ? (
        <div className="grid cols4">{[0, 1, 2, 3].map(i => <div className="skeleton" key={i} />)}</div>
      ) : unified ? (
        Object.entries(groupByProject(all)).map(([name, list]) => (
          <div key={name}>
            <h2 style={{ margin: "14px 0 6px" }}>{name}</h2>
            <TaskBoard tasks={list as Task[]} />
          </div>
        ))
      ) : (
        <TaskBoard tasks={all} />
      )}

      {/* מפת Pelago — פריט משני, מוסתר ברירת מחדל */}
      <h2 style={{ marginTop: 24 }}>מפת Pelago <button className="ghost" style={{ fontSize: 14, padding: "6px 14px" }} onClick={() => setShowMap(v => !v)}>{showMap ? "הסתר" : "הצג"}</button></h2>
      {showMap && (
        <div className="card">
          <iframe className="pelago" src="/pelago-map" title="Pelago map" />
          <div className="muted" style={{ marginTop: 8 }}>כל פרויקט הוא אי — המפה נבנית מדפי הריצות (מתעדכנת לילית ואחרי סיום משימה)</div>
        </div>
      )}
    </>
  );
}

function groupByProject(tasks: Task[]) {
  const map: Record<string, Task[]> = {};
  for (const t of tasks) (map[t.project_name ?? "כללי"] ??= []).push(t);
  return map;
}

"use client";
import { useApi, api, age } from "@/components/ui";
import { Kanban } from "@/components/kanban";
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
      <h1>לוח מחוונים</h1>

      <div className="grid cols4">
        <div className="card"><span className="muted">משימות פעילות</span><div className="kpi">{active.length}</div></div>
        <div className="card"><span className="muted">ממתין למשוב</span><div className="kpi">{awaitingFeedback.length}</div></div>
        <div className="card"><span className="muted">קבלה בניסיון ראשון</span><div className="kpi">{stats?.firstPassAcceptance != null ? `${Math.round(stats.firstPassAcceptance * 100)}%` : "—"}</div></div>
        <div className="card"><span className="muted">ציון הבנה</span><div className="kpi">{stats?.understandingScore != null ? `${Math.round(stats.understandingScore * 100)}%` : "—"}</div></div>
        <div className="card"><span className="muted">עלות החודש</span><div className="kpi">${Number(budget).toFixed(2)} <small>/ $50</small></div>
          <div style={{ background: "var(--panel2)", height: 6, borderRadius: 3, marginTop: 6 }}>
            <div style={{ width: `${Math.min(100, budget / 50 * 100)}%`, height: 6, borderRadius: 3, background: budget > 40 ? "var(--red)" : "var(--accent)" }} />
          </div></div>
        <div className="card"><span className="muted">לקחים מאושרים</span><div className="kpi">{stats?.lessonsApproved ?? 0} <small>+{stats?.lessonsProposed ?? 0} מוצעים</small></div></div>
      </div>

      <h2>מפת Pelago</h2>
      <div className="card">
        <iframe className="pelago" src={process.env.NEXT_PUBLIC_PELAGO_URL || "/pelago-placeholder.html"} title="Pelago map" />
        <div className="muted" style={{ marginTop: 6 }}>כל פרויקט הוא אי — המפה נבנית מדפי הריצות (מתעדכנת לילית ואחרי סיום משימה)</div>
      </div>

      <h2>משימות {unified ? "— לוח מאוחד (swimlanes לפי פרויקט)" : ""}</h2>
      <label className="muted"><input type="checkbox" checked={unified} onChange={e => setUnified(e.target.checked)} /> לוח מאוחד לכל הפרויקטים</label>

      <form className="inline" onSubmit={e => { e.preventDefault(); createTask(); }} style={{ margin: "10px 0" }}>
        <input placeholder="משימה חדשה…" value={title} onChange={e => setTitle(e.target.value)} style={{ minWidth: 240 }} />
        <select value={projectId} onChange={e => setProjectId(e.target.value)}>
          <option value="">כללי (ללא פרויקט)</option>
          {(projects?.projects ?? []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button>הוסף</button>
      </form>

      {unified ? (
        Object.entries(groupByProject(all)).map(([name, list]) => (
          <div key={name}>
            <h2 style={{ margin: "14px 0 6px" }}>{name}</h2>
            <Kanban tasks={list as Task[]} />
          </div>
        ))
      ) : (
        <Kanban tasks={all} />
      )}
    </>
  );
}

function groupByProject(tasks: Task[]) {
  const map: Record<string, Task[]> = {};
  for (const t of tasks) (map[t.project_name ?? "כללי"] ??= []).push(t);
  return map;
}

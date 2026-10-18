"use client";
import { use } from "react";
import { useApi, api, age, statusLabel } from "@/components/ui";
import { Kanban } from "@/components/kanban";
import Link from "next/link";

export default function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: projects } = useApi<{ projects: Record<string, any>[] }>("/api/projects");
  const { data: tasks, reload } = useApi<{ tasks: Record<string, any>[] }>(`/api/tasks`);
  const { data: lessons } = useApi<{ lessons: Record<string, any>[] }>("/api/lessons");
  const project = (projects?.projects ?? []).find(p => p.slug === slug);

  if (!projects) return null;
  if (!project) return <div className="card">פרויקט לא נמצא. <Link href="/projects">חזרה</Link></div>;

  const pt = (tasks?.tasks ?? []).filter(t => t.project_id === project.id);
  const done = pt.filter(t => t.status === "done").length;
  const pLessons = (lessons?.lessons ?? []).filter(l => l.status === "approved" && (l.scope === "global" || (l.scope === "project" && l.scope_ref === slug)));

  return (
    <>
      <h1>{project.name}</h1>
      <div className="muted" style={{ marginBottom: 14 }}>
        {project.subdomain ? <>{project.subdomain}.haviv.pro · </> : null}
        מקור: {project.work_source}{project.work_source_ref ? ` (${project.work_source_ref})` : ""} ·
        אוטונומיה: {project.autonomy} · נוצר {age(project.created_at)}
      </div>

      <div className="grid cols4" style={{ marginBottom: 16 }}>
        <div className="card"><span className="muted">משימות פתוחות</span><div className="kpi">{pt.filter(t => t.status !== "done" && t.status !== "blocked").length}</div></div>
        <div className="card"><span className="muted">הושלמו</span><div className="kpi">{done}</div></div>
        <div className="card"><span className="muted">לקחים רלוונטיים</span><div className="kpi">{pLessons.length}</div></div>
        <div className="card"><span className="muted">אוטונומיה</span><div className="kpi" style={{ fontSize: 18 }}>{project.autonomy}</div></div>
      </div>

      <h2>לוח משימות</h2>
      <Kanban tasks={pt} />
    </>
  );
}

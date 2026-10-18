"use client";
import { useApi, api, age } from "@/components/ui";
import Link from "next/link";
import { useState } from "react";

export default function Projects() {
  const { data, reload } = useApi<{ projects: Record<string, any>[] }>("/api/projects");
  const { data: tasks } = useApi<{ tasks: Record<string, any>[] }>("/api/tasks");
  const [name, setName] = useState("");
  const [source, setSource] = useState("local");
  const [ref, setRef] = useState("");

  async function create() {
    if (!name.trim()) return;
    await api("/api/projects", "POST", { name, workSource: source, workSourceRef: ref || null });
    setName(""); setRef(""); reload();
  }

  const projects = data?.projects ?? [];
  return (
    <>
      <h1>פרויקטים</h1>
      <form className="inline" onSubmit={e => { e.preventDefault(); create(); }} style={{ marginBottom: 16 }}>
        <input placeholder="שם פרויקט" value={name} onChange={e => setName(e.target.value)} />
        <select value={source} onChange={e => setSource(e.target.value)}>
          <option value="local">תיקייה ב-VPS</option><option value="github">GitHub</option><option value="gdrive">Google Drive</option>
        </select>
        <input placeholder={source === "github" ? "owner/repo" : source === "gdrive" ? "מזהה תיקייה" : "נתיב"} value={ref} onChange={e => setRef(e.target.value)} />
        <button>הוסף פרויקט</button>
      </form>
      <div className="grid cols3">
        <Link className="card" href="/tasks?project=general"><b>כללי</b><div className="muted">משימות ללא פרויקט</div>
          <div className="muted" style={{ marginTop: 8 }}>{(tasks?.tasks ?? []).filter(t => !t.project_id && t.status !== "done").length} פתוחות</div></Link>
        {projects.map(p => {
          const open = (tasks?.tasks ?? []).filter(t => t.project_id === p.id && t.status !== "done").length;
          return (
            <Link className="card" key={p.id} href={`/projects/${p.slug}`}>
              <b>{p.name}</b>
              <div className="muted">{p.subdomain ? `${p.subdomain}.haviv.pro` : "ללא תת-דומיין"} · {p.work_source}</div>
              <div className="muted" style={{ marginTop: 8 }}>{open} משימות פתוחות · תקציב ${p.budget_usd}</div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

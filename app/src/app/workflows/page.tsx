"use client";
import { useApi, api } from "@/components/ui";
import { useState } from "react";

type WF = { id: string; name: string; scope: string; scope_ref: string | null; graph_json: string; version: number; active: number };

export default function Workflows() {
  const { data, reload } = useApi<{ workflows: WF[] }>("/api/workflows");
  const [sel, setSel] = useState<string | null>(null);
  const [editJson, setEditJson] = useState("");
  const wfs = data?.workflows ?? [];
  const byName = new Map<string, WF[]>();
  for (const w of wfs) (byName.get(w.name) ?? byName.set(w.name, []).get(w.name)!).push(w);
  const selected = wfs.find(w => w.id === sel);

  function renderGraph(json: string) {
    let g: { nodes?: { id: string; label?: string; type?: string }[]; edges?: { from: string; to: string }[] };
    try { g = JSON.parse(json); } catch { return <div className="muted">JSON שגוי</div>; }
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {(g.nodes ?? []).map((n, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="chip" style={{
              background: n.type === "decision" ? "var(--yellow)" : n.type === "approval" ? "var(--accent)" : n.type === "check" ? "var(--green)" : "var(--panel2)",
              color: n.type === "decision" ? "#3a2a00" : n.type === "approval" ? "#fff" : n.type === "check" ? "#052e1c" : undefined,
            }}>{n.label ?? n.id}</span>
            {i < (g.edges ?? []).length && <span className="muted">←</span>}
          </span>
        ))}
      </div>
    );
  }

  return (
    <>
      <h1>עורך תהליכים</h1>
      <div className="grid cols3">
        {[...byName.entries()].map(([name, versions]) => {
          const active = versions.find(v => v.active) ?? versions[versions.length - 1];
          return (
            <div className="card" key={name} onClick={() => { setSel(active.id); setEditJson(active.graph_json); }} style={{ cursor: "pointer" }}>
              <b>{name}</b> <span className="chip">v{active.version}</span>
              <div className="muted">{active.scope === "global" ? "גלובלי" : `פרויקט: ${active.scope_ref}`}</div>
              <div style={{ margin: "10px 0" }}>{renderGraph(active.graph_json)}</div>
              {versions.length > 1 && <div className="muted">{versions.length} גרסאות — היסטוריה:
                {versions.map(v => <span key={v.id} className="chip" style={{ marginInlineStart: 4, opacity: v.active ? 1 : 0.5 }}>v{v.version}{v.active ? " ✓" : ""}</span>)}
              </div>}
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>עריכה: {selected.name} v{selected.version}</h2>
          <textarea value={editJson} onChange={e => setEditJson(e.target.value)} style={{ width: "100%", minHeight: 200, fontFamily: "monospace", direction: "ltr" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={async () => { await api("/api/workflows", "POST", { basedOn: selected.id, graphJson: editJson }); setSel(null); reload(); }}>שמור כגרסה חדשה</button>
            {selected.active ? null : <button onClick={async () => { await api("/api/workflows", "PATCH", { id: selected.id }); reload(); }} className="ghost">הפעל גרסה זו</button>}
            {!wfs.find(w => w.name === selected.name && w.active) && <span className="muted" style={{ color: "var(--yellow)" }}>אין גרסה פעילה — הפעל אחת</span>}
          </div>
          <div style={{ marginTop: 12 }}>{renderGraph(editJson)}</div>
        </div>
      )}

      <NewWorkflow onDone={reload} />
    </>
  );
}

function NewWorkflow({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [scope, setScope] = useState("global");
  const [scopeRef, setScopeRef] = useState("");
  const [nodes, setNodes] = useState("");
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 style={{ marginTop: 0 }}>תהליך חדש</h2>
      <form className="inline" onSubmit={async e => {
        e.preventDefault();
        const graph = {
          nodes: nodes.split("→").map(s => s.trim()).filter(Boolean).map((label, i) => ({ id: `n${i}`, label })),
          edges: nodes.split("→").filter(Boolean).slice(1).map((_, i) => ({ from: `n${i}`, to: `n${i + 1}` })),
        };
        await api("/api/workflows", "POST", { name, scope, scopeRef: scopeRef || null, graph });
        onDone(); setName(""); setNodes("");
      }}>
        <input placeholder="שם (למשל: פרויקט חדש)" value={name} onChange={e => setName(e.target.value)} />
        <select value={scope} onChange={e => setScope(e.target.value)}>
          <option value="global">גלובלי</option><option value="project">לפרויקט</option>
        </select>
        {scope === "project" && <input placeholder="slug פרויקט" value={scopeRef} onChange={e => setScopeRef(e.target.value)} />}
        <input placeholder="צעדים מופרדים ב-→ (repo → Coolify → תת-דומיין → SSO → בדיקה)" value={nodes} onChange={e => setNodes(e.target.value)} style={{ minWidth: 320 }} />
        <button>צור</button>
      </form>
    </div>
  );
}

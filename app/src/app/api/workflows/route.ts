export const dynamic = "force-dynamic";

import { db, uid } from "@/lib/sqlite";
import { audit, requireAuth, jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (id) return Response.json({ workflow: db().prepare("SELECT * FROM workflows WHERE id = ?").get(id) ?? null });
  return Response.json({ workflows: db().prepare("SELECT * FROM workflows ORDER BY created_at DESC").all() });
}

// POST — create new workflow or propose a new version (agent proposes via token; user approves)
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const b = await req.json();
  if (b.basedOn) {
    // new version of an existing workflow: version bump, inactive until user activates
    const base = db().prepare("SELECT * FROM workflows WHERE id = ?").get(b.basedOn) as Record<string, unknown> | undefined;
    if (!base) return jsonError("base workflow not found", 404);
    const id = uid();
    const version = (base.version as number) + 1;
    const active = auth.channel === "mcp" ? 0 : 1;
    db().prepare(
      `INSERT INTO workflows (id, name, scope, scope_ref, graph_json, version, active) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, base.name as string, base.scope as string, (base.scope_ref as string | null), b.graphJson, version, active ? 1 : 0);
    await audit(auth.actor, auth.channel, "workflow.propose", `${base.name} v${version}`);
    return Response.json({ id, version, active });
  }
  const id = uid();
  db().prepare(
    `INSERT INTO workflows (id, name, scope, scope_ref, graph_json, version, active) VALUES (?, ?, ?, ?, ?, 1, 1)`
  ).run(id, b.name, b.scope ?? "global", b.scopeRef ?? null, JSON.stringify(b.graph ?? { nodes: [], edges: [] }));
  await audit(auth.actor, auth.channel, "workflow.create", b.name);
  return Response.json({ id });
}

// PATCH — activate a version (user approves the agent's proposal here)
export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const b = await req.json();
  const wf = db().prepare("SELECT * FROM workflows WHERE id = ?").get(b.id) as Record<string, unknown> | undefined;
  if (!wf) return jsonError("not found", 404);
  if (auth.channel === "mcp") return jsonError("only the user activates workflow versions", 403);
  db().prepare(`UPDATE workflows SET active = 0 WHERE name = ?`).run(wf.name as string);
  db().prepare(`UPDATE workflows SET active = 1 WHERE id = ?`).run(b.id);
  await audit(auth.actor, auth.channel, "workflow.activate", `${b.id}`);
  return Response.json({ ok: true });
}

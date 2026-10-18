export const dynamic = "force-dynamic";

import { db, uid, sqlArgs } from "@/lib/sqlite";
import { audit, requireAuth, jsonError } from "@/lib/api";

// POST /api/runs — open a run (run.start)
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const b = await req.json();
  const id = uid();
  db().prepare(
    `INSERT INTO runs (id, task_id, parent_run_id, agent_kind, agent_name, model, workflow_step, lessons_applied)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, b.taskId, b.parentRunId ?? null, b.agentKind ?? "main", b.agentName ?? "hermes",
        b.model ?? "z-ai/glm-5.3-flash", b.workflowStep ?? null, (b.lessonsApplied ?? []).join(","));
  db().prepare(`UPDATE tasks SET status = CASE WHEN ? = 'main' THEN 'in_progress' ELSE status END, updated_at = datetime('now') WHERE id = ?`)
    .run(b.agentKind ?? "main", b.taskId);
  await audit(auth.actor, auth.channel, "run.start", id);
  return Response.json({ id });
}

// PATCH /api/runs — close a run (run.finish): steps, tokens, cost, artifacts, log
export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const b = await req.json();
  const { id, ...f } = b;
  if (!id) return jsonError("id required");
  const run = db().prepare("SELECT * FROM runs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!run) return jsonError("not found", 404);
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const k of ["status", "log", "steps", "artifacts", "input_tokens", "output_tokens", "cost_usd", "workflow_step", "agent_name"]) {
    if (k in f) { sets.push(`${k} = ?`); args.push(f[k]); }
  }
  if (f.status && f.status !== "running" && !("ended_at" in f)) { sets.push("ended_at = datetime('now')"); }
  if (f.artifacts) sets[sets.indexOf("artifacts = ?")] = "artifacts = ?"; // csv kept as-is
  if (!sets.length) return jsonError("nothing to update");
  args.push(id);
  db().prepare(`UPDATE runs SET ${sets.join(", ")} WHERE id = ?`).run(...sqlArgs(args));
  // On run finish (main agent): move task to awaiting_feedback
  if (f.status === "done" && run.agent_kind === "main") {
    db().prepare(`UPDATE tasks SET status = 'awaiting_feedback', updated_at = datetime('now') WHERE id = ?`).run(run.task_id as string);
  }
  await audit(auth.actor, auth.channel, "run.finish", id);
  return Response.json({ ok: true });
}

// GET /api/runs?taskId= — timeline of runs for task page
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const taskId = new URL(req.url).searchParams.get("taskId");
  if (!taskId) return jsonError("taskId required");
  const rows = db().prepare(
    `SELECT r.*, f.execution_light, f.understanding_light, f.outcome_achieved, f.needs_fix
     FROM runs r LEFT JOIN feedback f ON f.run_id = r.id
     WHERE r.task_id = ? ORDER BY r.started_at ASC`
  ).all(taskId);
  return Response.json({ runs: rows });
}

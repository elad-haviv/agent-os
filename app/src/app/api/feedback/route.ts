export const dynamic = "force-dynamic";

import { db, uid } from "@/lib/sqlite";
import { audit, requireAuth, jsonError } from "@/lib/api";

// POST /api/feedback — user gives feedback on a run (traffic lights + details)
// This is the ONLY path that can move a task to done (protected transition).
// needsFix=true -> task returns to 'fixing' (short loop).
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  if (auth.channel === "mcp") return jsonError("only the user gives feedback", 403);
  const b = await req.json();
  const run = db().prepare("SELECT * FROM runs WHERE id = ?").get(b.runId) as Record<string, unknown> | undefined;
  if (!run) return jsonError("run not found", 404);

  const id = uid();
  db().prepare(
    `INSERT INTO feedback (id, run_id, understanding_light, execution_light, outcome_achieved, mistakes, what_should_have, tags, needs_fix)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, b.runId, b.understandingLight ?? "none", b.executionLight ?? "none",
        b.outcomeAchieved ?? "pending", b.mistakes ?? "", b.whatShouldHave ?? "",
        (b.tags ?? []).join(","), b.needsFix ? 1 : 0);

  const task = db().prepare("SELECT * FROM tasks WHERE id = ?").get(run.task_id as string) as Record<string, unknown>;
  if (b.needsFix) {
    db().prepare(`UPDATE tasks SET status = 'fixing', updated_at = datetime('now') WHERE id = ?`).run(task.id as string);
  } else if (b.executionLight === "green") {
    // green -> done (yellow requires explicit approval to close)
    db().prepare(`UPDATE tasks SET status = 'done', updated_at = datetime('now') WHERE id = ?`).run(task.id as string);
  }
  db().prepare("UPDATE feedback SET processed = 1 WHERE id = ?").run(id);
  await audit(auth.actor, auth.channel, "feedback.create", `${id} run=${b.runId} exec=${b.executionLight} fix=${b.needsFix}`);
  return Response.json({ id });
}

// GET /api/feedback?pending=1 — feedback queue (תור המשוב): finished runs awaiting user lights
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const url = new URL(req.url);
  if (url.searchParams.get("pending")) {
    const rows = db().prepare(
      `SELECT r.*, t.title AS task_title, t.id AS task_id, t.project_id, p.name AS project_name
       FROM runs r JOIN tasks t ON t.id = r.task_id LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN feedback f ON f.run_id = r.id
       WHERE r.status = 'done' AND r.agent_kind = 'main' AND f.id IS NULL
       ORDER BY r.ended_at DESC`
    ).all();
    return Response.json({ queue: rows });
  }
  const rows = db().prepare(
    `SELECT f.*, r.task_id, t.title AS task_title FROM feedback f JOIN runs r ON r.id = f.run_id JOIN tasks t ON t.id = r.task_id ORDER BY f.created_at DESC LIMIT 200`
  ).all();
  return Response.json({ feedback: rows });
}

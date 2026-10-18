export const dynamic = "force-dynamic";

import { db, uid, now, sqlArgs } from "@/lib/sqlite";
import { audit, requireAuth, jsonError } from "@/lib/api";

// POST /api/tasks — create (origin: app | gateway | cron; agent via token)
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const b = await req.json();
  const id = uid();
  db().prepare(
    `INSERT INTO tasks (id, title, project_id, origin, required_outcome, understanding, priority, tags, task_type, workflow_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, b.title, b.projectId ?? null, b.origin ?? "app",
        JSON.stringify(b.requiredOutcome ?? []), b.understanding ?? null,
        b.priority ?? 2, (b.tags ?? []).join(","), b.taskType ?? "general", b.workflowId ?? null);
  await audit(auth.actor, auth.channel, "task.create", `${id}:${b.title}`);
  return Response.json({ id });
}

// GET /api/tasks — list with filters (kanban board, unified board, filters)
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId"); // null = all (unified board), "general" = unassigned
  const status = url.searchParams.get("status");
  const priority = url.searchParams.get("priority");
  const tag = url.searchParams.get("tag");

  let sql = `SELECT t.*, p.name AS project_name, p.slug AS project_slug,
    (SELECT COUNT(*) FROM runs r WHERE r.task_id = t.id) AS run_count,
    (SELECT SUM(r.cost_usd) FROM runs r WHERE r.task_id = t.id) AS total_cost,
    (SELECT MAX(r.ended_at) FROM runs r WHERE r.task_id = t.id) AS last_run_at
    FROM tasks t LEFT JOIN projects p ON p.id = t.project_id WHERE 1=1`;
  const args: unknown[] = [];
  if (projectId === "general") sql += ` AND t.project_id IS NULL`;
  else if (projectId) { sql += ` AND t.project_id = ?`; args.push(projectId); }
  if (status) { sql += ` AND t.status = ?`; args.push(status); }
  if (priority) { sql += ` AND t.priority = ?`; args.push(Number(priority)); }
  if (tag) { sql += ` AND (',' || t.tags || ',') LIKE ?`; args.push(`%,${tag},%`); }
  sql += ` ORDER BY t.updated_at DESC LIMIT 500`;

  const rows = db().prepare(sql).all(...sqlArgs(args)) as Record<string, unknown>[];
  return Response.json({ tasks: rows.map(r => ({ ...r, required_outcome: JSON.parse((r.required_outcome as string) ?? "[]") })) });
}

// PATCH /api/tasks — update status/understanding etc. Protected transition enforced here.
export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const b = await req.json();
  const { id, ...fields } = b;
  if (!id) return jsonError("id required");
  const task = db().prepare("SELECT * FROM tasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!task) return jsonError("not found", 404);

  const byAgent = auth.channel === "mcp";
  if (fields.status && byAgent && fields.status === "done") {
    return jsonError("protected transition: only user feedback can complete a task", 403);
  }
  if (fields.status === "in_progress" && !task.understanding_approved) {
    return jsonError("understanding must be approved before execution", 403);
  }
  const sets: string[] = ["updated_at = ?"];
  const args: unknown[] = [now()];
  for (const k of ["status", "understanding", "understanding_approved", "required_outcome", "priority", "tags", "workflow_id", "blocked_reason", "title", "golden"]) {
    if (k in fields) { sets.push(`${k} = ?`); args.push(typeof fields[k] === "object" ? JSON.stringify(fields[k]) : fields[k]); }
  }
  args.push(id);
  db().prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...sqlArgs(args));
  await audit(auth.actor, auth.channel, "task.update", `${id}:${fields.status ?? ""}`);
  return Response.json({ ok: true });
}

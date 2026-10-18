export const dynamic = "force-dynamic";

import { db, uid, sqlArgs } from "@/lib/sqlite";
import { audit, requireAuth, jsonError } from "@/lib/api";

// GET /api/lessons — standards book (approved) + proposed queue
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const scope = url.searchParams.get("scope");
  const query = url.searchParams.get("q"); // for lessons.search
  let sql = "SELECT * FROM lessons WHERE 1=1";
  const args: unknown[] = [];
  if (status) { sql += " AND status = ?"; args.push(status); }
  if (scope) { sql += " AND scope = ?"; args.push(scope); }
  if (query) { sql += " AND rule LIKE ?"; args.push(`%${query}%`); }
  sql += " ORDER BY updated_at DESC LIMIT 500";
  return Response.json({ lessons: db().prepare(sql).all(...sqlArgs(args)) });
}

// POST /api/lessons — propose a lesson (agent) or create directly (user)
// Always lands as 'proposed' when from agent; user approve happens via PATCH.
export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const b = await req.json();
  const id = uid();
  const status = auth.channel === "mcp" ? "proposed" : (b.status ?? "approved");
  // conflict detection: overlapping scope + similar rule wording
  const conflicts = db().prepare("SELECT id, rule FROM lessons WHERE status = 'approved' AND scope = ? AND rule LIKE ?")
    .all((b.scope ?? "global") as string, `%${(b.rule ?? "").split(" ").slice(0, 4).join(" ")}%`) as { id: string; rule: string }[];
  db().prepare(
    `INSERT INTO lessons (id, rule, scope, scope_ref, source_feedback_id, status, conflict_with)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, b.rule, b.scope ?? "global", b.scopeRef ?? null, b.sourceFeedbackId ?? null, status,
        b.conflictWith ?? (conflicts[0]?.id ?? null));
  await audit(auth.actor, auth.channel, "lesson.propose", `${id}:${b.rule}`);
  return Response.json({ id, conflictWith: conflicts[0]?.id ?? null });
}

// PATCH /api/lessons — approve / edit / retire / merge (user only for approval)
export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const b = await req.json();
  const { id, ...f } = b;
  if (!id) return jsonError("id required");
  if ((f.status === "approved" || f.status === "retired") && auth.channel === "mcp") {
    return jsonError("only the user approves or retires lessons", 403);
  }
  if (f.mergeInto) {
    // consolidation: retire this, bump the target's applied count
    db().prepare(`UPDATE lessons SET status = 'retired', conflict_with = ?, updated_at = datetime('now') WHERE id = ?`).run(f.mergeInto, id);
    db().prepare(`UPDATE lessons SET applied_count = applied_count + 1 WHERE id = ?`).run(f.mergeInto);
  } else {
    const sets: string[] = ["updated_at = datetime('now')"];
    const args: unknown[] = [];
    for (const k of ["rule", "scope", "scope_ref", "status", "conflict_with"]) {
      if (k in f) { sets.push(`${k} = ?`); args.push(f[k]); }
    }
    if (!sets.length) return jsonError("nothing to update");
    args.push(id);
    db().prepare(`UPDATE lessons SET ${sets.join(", ")} WHERE id = ?`).run(...sqlArgs(args));
  }
  await audit(auth.actor, auth.channel, "lesson.update", `${id}:${f.status ?? ""}`);
  return Response.json({ ok: true });
}

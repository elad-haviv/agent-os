export const dynamic = "force-dynamic";

import { db, uid, sqlArgs } from "@/lib/sqlite";
import { audit, requireAuth, jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  return Response.json({ projects: db().prepare("SELECT * FROM projects ORDER BY name").all() });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const b = await req.json();
  const slug = (b.slug || b.name || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) return jsonError("name required");
  const id = uid();
  db().prepare(
    `INSERT INTO projects (id, name, slug, work_source, work_source_ref, subdomain, coolify_app, bank_name, autonomy, budget_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, b.name, slug, b.workSource ?? "local", b.workSourceRef ?? null, b.subdomain ?? null,
        b.coolifyApp ?? null, b.bankName ?? null, b.autonomy ?? "standard", b.budgetUsd ?? 50);
  await audit(auth.actor, auth.channel, "project.create", slug);
  return Response.json({ id, slug });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const b = await req.json();
  const { id, ...f } = b;
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const k of ["name", "subdomain", "coolify_app", "bank_name", "autonomy", "budget_usd", "status", "work_source", "work_source_ref"]) {
    if (k in f) { sets.push(`${k} = ?`); args.push(f[k]); }
  }
  if (!sets.length) return jsonError("nothing to update");
  args.push(id);
  db().prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ?`).run(...sqlArgs(args));
  await audit(auth.actor, auth.channel, "project.update", id);
  return Response.json({ ok: true });
}

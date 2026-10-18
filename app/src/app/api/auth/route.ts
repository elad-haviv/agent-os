export const dynamic = "force-dynamic";

import { db, uid, now } from "@/lib/sqlite";
import { audit } from "@/lib/api";
import { getSessionUser } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password, name } = await req.json();
  const d = db();
  const exists = d.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) return Response.json({ error: "email exists" }, { status: 400 });
  const hash = (await import("bcryptjs")).hashSync(password, 10);
  const id = uid();
  d.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)").run(id, email, name ?? email, hash);
  const { createSession } = await import("@/lib/auth");
  await createSession(id, "app");
  await audit(email, "app", "user.register", email);
  return Response.json({ ok: true });
}

export async function PUT(req: Request) {
  // login
  const { email, password } = await req.json();
  const row = db().prepare("SELECT * FROM users WHERE email = ?").get(email) as
    | { id: string; password_hash: string }
    | undefined;
  if (!row) return Response.json({ error: "invalid credentials" }, { status: 401 });
  const ok = (await import("bcryptjs")).compareSync(password, row.password_hash);
  if (!ok) return Response.json({ error: "invalid credentials" }, { status: 401 });
  await (await import("@/lib/auth")).createSession(row.id, "app");
  await audit(email, "app", "user.login", email);
  return Response.json({ ok: true });
}

export async function DELETE() {
  const u = await getSessionUser();
  if (u) await audit(u.email, "app", "user.logout", "");
  await (await import("@/lib/auth")).destroySession();
  return Response.json({ ok: true });
}

export async function GET() {
  const u = await getSessionUser();
  return Response.json({ user: u });
}

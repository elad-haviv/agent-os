export const dynamic = "force-dynamic";

import { db } from "@/lib/sqlite";
import { getSessionUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

// Change own password (logged-in user only).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { password } = await req.json();
  if (!password || String(password).length < 8) {
    return Response.json({ error: "password too short (min 8)" }, { status: 400 });
  }
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), user.id);
  return Response.json({ ok: true });
}

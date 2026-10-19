export const dynamic = "force-dynamic";

import { db } from "@/lib/sqlite";
import { requireAuth, jsonError } from "@/lib/api";

// List user emails (no hashes) — for the agent/dashboard; requires auth.
export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (!auth) return jsonError("unauthorized", 401);
  const users = db().prepare("SELECT email, name, role, created_at FROM users").all();
  return Response.json({ users });
}

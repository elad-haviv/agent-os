export const dynamic = "force-dynamic";

import { db, uid, now } from "@/lib/sqlite";
import { audit } from "@/lib/api";
import { hashToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// One-time bootstrap: creates first owner user + default agent service token.
// Guard: only works while there are zero users.
export async function POST(req: Request) {
  const d = db();
  const count = (d.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
  const agentHeader = req.headers.get("x-agent-token");
  if (count > 0) return Response.json({ error: "already bootstrapped — sign in instead" }, { status: 403 });

  const { email, password, name } = await req.json();
  const uidUser = uid();
  d.prepare("INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)")
    .run(uidUser, email, name ?? email, bcrypt.hashSync(password, 10));

  // Default agent service token (from env AGENT_TOKEN or generated; returned ONCE)
  const raw = process.env.AGENT_TOKEN && process.env.AGENT_TOKEN !== "dev-agent-token-change-me"
    ? process.env.AGENT_TOKEN : `aos_${crypto.randomUUID().replace(/-/g, "")}`;
  d.prepare("INSERT OR IGNORE INTO service_tokens (id, name, token_hash, scopes) VALUES (?, ?, ?, ?)")
    .run(uid(), "hermes-main", hashToken(raw), "read,write");

  await audit(email, "app", "bootstrap", "first user + agent token created");
  return Response.json({ ok: true, agentToken: raw });
}

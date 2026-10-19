export const dynamic = "force-dynamic";

import { db } from "@/lib/sqlite";

// Pelago map — every project is an island, sized by activity, biome colored by work source.
// Rendered as SVG so it needs no external JS and loads instantly in the dashboard iframe.
type Proj = {
  id: string; name: string; slug: string; work_source: string; status: string;
  runs: number; tokens: number; tasks: number; done: number;
};

const BIOME_COLOR: Record<string, string> = {
  github: "#3fb27f",   // tech — green
  gdrive: "#4f8fd8",   // forest — deep blue-green
  local: "#d8b45f",    // plains — sand
};
const BIOME_LABEL: Record<string, string> = { github: "טכנולוגיה", gdrive: "יער", local: "מישור" };

function projectIsland(i: number, total: number, p: Proj) {
  // Spread islands in an arc across the ocean
  const W = 960, H = 540;
  const cx = W * (0.12 + 0.76 * (total === 1 ? 0.5 : i / (total - 1)));
  const cy = H * (0.28 + 0.42 * ((i * 37) % 100) / 100);
  // radius by activity: runs + tasks weight, min 18, max 70
  const activity = p.runs * 2 + p.tasks;
  const r = Math.min(70, Math.max(18, 18 + Math.sqrt(activity) * 8));
  const color = BIOME_COLOR[p.work_source] ?? BIOME_COLOR.local;
  const donePct = p.tasks ? Math.round(p.done / p.tasks * 100) : 0;
  return { cx, cy, r, color, donePct };
}

export default function PelagoMap() {
  let projects: Proj[] = [];
  try {
    projects = db().prepare(`
      SELECT p.id, p.name, p.slug, p.work_source, p.status,
        COUNT(DISTINCT r.id) AS runs,
        COALESCE(SUM(r.input_tokens + r.output_tokens), 0) AS tokens,
        COUNT(DISTINCT t.id) AS tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS done
      FROM projects p
      LEFT JOIN tasks t ON t.project_id = p.id
      LEFT JOIN runs r ON r.task_id = t.id
      GROUP BY p.id ORDER BY runs DESC, tasks DESC
    `).all() as unknown as Proj[];
  } catch { /* empty db — show placeholder sea */ }

  const totalTokens = projects.reduce((s, p) => s + (p.tokens ?? 0), 0);

  return (
    <svg viewBox="0 0 960 540" width="100%" height="100%" style={{ display: "block", background: "linear-gradient(180deg,#07253e 0%,#0a3a5c 55%,#0d4a6e 100%)" }}>
      <defs>
          <radialGradient id="seaGlow" cx="50%" cy="45%">
            <stop offset="0%" stopColor="#0f6a99" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0a3a5c" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="960" height="540" fill="url(#seaGlow)" />
        {/* grid of faint longitude lines for the "map" feel */}
        {Array.from({ length: 12 }, (_, i) => <line key={"v"+i} x1={i * 80} y1="0" x2={i * 80} y2="540" stroke="#ffffff" strokeOpacity="0.04" />)}
        {Array.from({ length: 7 }, (_, i) => <line key={"h"+i} x1="0" y1={i * 80} x2="960" y2={i * 80} stroke="#ffffff" strokeOpacity="0.04" />)}

        {projects.map((p, i) => {
          const { cx, cy, r, color, donePct } = projectIsland(i, projects.length, p);
          return (
            <g key={p.id}>
              {/* island shadow */}
              <ellipse cx={cx} cy={cy + r * 0.55} rx={r * 1.25} ry={r * 0.35} fill="#000" opacity="0.25" />
              {/* island body */}
              <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.72} fill={color} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="2" />
              {/* progress ring: portion done */}
              <ellipse cx={cx} cy={cy} rx={r * 0.85} ry={r * 0.55} fill="none" stroke="#e7ecf7" strokeOpacity="0.5" strokeWidth="3"
                strokeDasharray={`${(donePct / 100) * 2 * Math.PI * r * 0.7} 9999`} transform={`rotate(-90 ${cx} ${cy})`} />
              <text x={cx} y={cy + r * 1.25} textAnchor="middle" fill="#e7ecf7" fontSize="15" fontWeight="600">{p.name}</text>
              <text x={cx} y={cy + r * 1.25 + 18} textAnchor="middle" fill="#8b96b3" fontSize="12">
                {p.tasks} משימות · {p.runs} ריצות · {BIOME_LABEL[p.work_source] ?? "מישור"}
              </text>
            </g>
          );
        })}

        {!projects.length && (
          <text x="480" y="270" textAnchor="middle" fill="#8b96b3" fontSize="20">הים ריק — הוסף פרויקט ראשון</text>
        )}

        <text x="20" y="30" fill="#e7ecf7" fontSize="16" fontWeight="700">Pelago — ארכיפלג הפרויקטים</text>
        <text x="20" y="52" fill="#8b96b3" fontSize="13">{totalTokens.toLocaleString()} טוקנים · {projects.length} איים</text>
        <text x="940" y="525" textAnchor="end" fill="#8b96b3" fontSize="12">גודל האי = פעילות · הטבעת = אחוז השלמה</text>
      </svg>
  );
}

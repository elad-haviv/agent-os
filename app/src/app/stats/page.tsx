"use client";
import { useApi } from "@/components/ui";

export default function Stats() {
  const { data: s } = useApi<Record<string, any>>("/api/stats");

  const pct = (v: number | null | undefined) => v != null ? `${Math.round(v * 100)}%` : "—";

  return (
    <>
      <h1>סטטיסטיקות</h1>
      <div className="grid cols4">
        <div className="card"><span className="muted">קבלה בניסיון ראשון</span><div className="kpi">{pct(s?.firstPassAcceptance)}</div><div className="muted">% משימות שקיבלו ירוק בלי ריצת תיקון</div></div>
        <div className="card"><span className="muted">ציון הבנה</span><div className="kpi">{pct(s?.understandingScore)}</div><div className="muted">% ירוק ברמזור ההבנה</div></div>
        <div className="card"><span className="muted">תיקונים למשימה</span><div className="kpi">{s?.avgRunsToGreen != null ? Number(s.avgRunsToGreen).toFixed(2) : "—"}</div><div className="muted">ממוצע ריצות עד ירוק</div></div>
        <div className="card"><span className="muted">זמן תגובה שלך</span><div className="kpi">{s?.avgUserResponseMinutes != null ? `${Math.round(s.avgUserResponseMinutes)} דק׳` : "—"}</div><div className="muted">מסיום ריצה ועד משוב</div></div>
        <div className="card"><span className="muted">עלות כוללת</span><div className="kpi">${Number(s?.costTotalUsd ?? 0).toFixed(2)}</div></div>
        <div className="card"><span className="muted">לקחים</span><div className="kpi">{s?.lessonsApproved ?? 0}</div><div className="muted">מאושרים · {s?.lessonsProposed ?? 0} מוצעים</div></div>
      </div>

      <h2>השגת הישג</h2>
      <div className="card">
        <table><tbody>
          {(s?.outcomes ?? []).map((o: any) => (
            <tr key={o.outcome_achieved}><td>{o.outcome_achieved === "yes" ? "כן" : o.outcome_achieved === "partial" ? "חלקית" : o.outcome_achieved === "no" ? "לא" : o.outcome_achieved}</td><td>{o.n}</td></tr>
          ))}
        </tbody></table>
      </div>

      <h2>עלות לפי מודל</h2>
      <div className="card">
        <table><thead><tr><th>מודל</th><th>עלות</th><th>טוקנים</th></tr></thead><tbody>
          {(s?.costByModel ?? []).map((m: any) => (
            <tr key={m.model}><td>{m.model}</td><td>${Number(m.cost ?? 0).toFixed(4)}</td><td>{Number(m.tokens ?? 0).toLocaleString()}</td></tr>
          ))}
        </tbody></table>
      </div>

      <h2>לפי פרויקט</h2>
      <div className="card">
        <table><thead><tr><th>פרויקט</th><th>משימות</th><th>הושלמו</th></tr></thead><tbody>
          {(s?.byProject ?? []).map((p: any) => (
            <tr key={p.name}><td>{p.name}</td><td>{p.tasks}</td><td>{p.done}</td></tr>
          ))}
        </tbody></table>
      </div>
    </>
  );
}

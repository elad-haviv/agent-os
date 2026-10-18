# Agent OS

מערכת הניהול וההכשרה של הסוכן — מימוש MVP (שלבים 1–2 מהאפיון).

## מה מומש

**לולאת הלמידה המלאה (שלב 1 + 2):**
- פרויקטים, משימות (כללי + פרויקטים), ריצות (ראשי/משנה), משוב, לקחים, תהליכי עבודה, סטטיסטיקות
- שער הבנה: הסוכן חייב אישור הבנה לפני ביצוע (`in_progress` נחסם עד `understanding_approved`)
- שני רמזורים: הבנה + ביצוע, והישג (כן/חלקית/לא)
- מעבר מוגן: רק משוב של המשתמש מעביר משימה ל"הושלם" — הסוכן נדחה עם 403
- לולאה קצרה: "דרוש תיקון" → המשימה חוזרת ל"בתיקון"
- לולאה ארוכה: `lessons.propose` → מוצע עד אישור → `lessons.search` שולף לקחים מאושרים
- סתירות מסומנות (`conflict_with`), איחוד/ביטול בספר הסטנדרטים
- תקציב: מעקב עלות מול $50/חודש בלוח המחוונים
- יומן ביקורת: כל פעולה (app/mcp) נרשמת
- PWA: manifest + תור משוב מותאם נייד

**מסכים:** לוח מחוונים (KPIs, מפת Pelago ב-iframe, לוח מאוחד swimlanes), פרויקטים, דף פרויקט, דף משימה (ציר ריצות + טופס משוב), תור משוב, ספר הסטנדרטים, עורך תהליכים (גרסאות + הפעלה), סטטיסטיקות, הגדרות.

**MCP לסוכן** (`POST /api/mcp`, Bearer service token): `project.set_context`, `task.create/update`, `run.start/finish`, `lessons.search/propose`, `feedback.pending`, `workflow.get/propose` — כל הכלים מהאפיון. אישורי לקחים/תהליכים/סגירת משימות נדחים לסוכן.

## ריצה מקומית

```bash
cd app
npm install
npm run build && npx next start -p 3210
# פתח http://localhost:3210 → הגדרות → אתחול ראשון (יוצר בעלים + מחזיר טוקן סוכן פעם אחת)
```

## פריסה ב-Coolify (compose stack)

1. פרויקט Coolify חדש `agent-os` → `POST /services` עם `docker-compose.yml` כ-base64 ב-`docker_compose_raw`, `instant_deploy: true`.
2. הרשת החיצונית `coolify` כבר מוכרזת; הראוטינג דרך תוויות Traefik (`os.haviv.pro`).
3. הגדר ב-Coolify env: `AGENT_TOKEN` (חדש וחזק!), ואופציונלי Hindsight/Garage vars.
4. Volume קיים: `agentos-data` (SQLite ב-/data). Postgres/Drizzle — להמשך; הסכמה זהה במבנה.
5. בדוק: `curl https://os.haviv.pro/api/auth` → 200.
6. SSO (Authentik + forward-auth) — שלב המשך; כרגע סיסמה מקומית + service token לסוכן.

## Pelago

`scripts/pelago-adapter.mjs` ממיר את ה-DB לקובץ האגרגטים של Pelago. Cron יומי + אחרי סיום משימה:
`node scripts/pelago-adapter.mjs > agentos.json && pelago.py --input agentos.json --output world.html` → העלאה ל-Garage → ה-iframe בלוח המחוונים מצביע על `NEXT_PUBLIC_PELAGO_URL`.

## הטמעת Hermes

הוסף להרמס חיבור MCP: URL `https://os.haviv.pro/api/mcp`, header `Authorization: Bearer <token>`.
בצ'אט: `/project bluegrid` → `project.set_context` → כל משימה נרשמת אוטומטית.

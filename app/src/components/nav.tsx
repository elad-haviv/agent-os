"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "לוח מחוונים" },
  { href: "/projects", label: "פרויקטים" },
  { href: "/feedback", label: "תור משוב" },
  { href: "/lessons", label: "ספר הסטנדרטים" },
  { href: "/workflows", label: "תהליכים" },
];
const NAV2 = [
  { href: "/stats", label: "סטטיסטיקות" },
  { href: "/settings", label: "הגדרות" },
];

export function Nav() {
  const path = usePathname();
  const [mapOn, setMapOn] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("agentos-map") === "1") setMapOn(true);
  }, []);
  const toggleMap = () => {
    setMapOn(v => {
      const next = !v;
      localStorage.setItem("agentos-map", next ? "1" : "0");
      document.body.dataset.map = next ? "on" : "off";
      return next;
    });
  };
  const isActive = (href: string) => href === "/" ? path === "/" : path.startsWith(href);
  const item = (n: { href: string; label: string }) => (
    <Link key={n.href} href={n.href} className={`nav-link ${isActive(n.href) ? "active" : ""}`} aria-current={isActive(n.href) ? "page" : undefined}>
      {n.label}
    </Link>
  );
  return (
    <header className="topnav">
      <Link className="brand" href="/">⧉ Agent OS</Link>
      <nav className="nav-main">{NAV.map(item)}</nav>
      <nav className="nav-secondary">{NAV2.map(item)}</nav>
      <button className="ghost map-toggle" onClick={toggleMap} aria-pressed={mapOn} title="הצג/הסתר מפת Pelago מטושטשת ברקע">
        🗺️ מפה
      </button>
    </header>
  );
}

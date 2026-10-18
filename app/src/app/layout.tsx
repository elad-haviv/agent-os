import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Agent OS",
  description: "ניהול, משוב וכוונון הסוכן",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0b1020", width: "device-width", initialScale: 1 };

const NAV = [
  { href: "/", label: "לוח מחוונים" },
  { href: "/projects", label: "פרויקטים" },
  { href: "/feedback", label: "תור משוב" },
  { href: "/lessons", label: "ספר הסטנדרטים" },
  { href: "/workflows", label: "תהליכים" },
  { href: "/stats", label: "סטטיסטיקות" },
  { href: "/settings", label: "הגדרות" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <header className="topnav">
          <Link className="brand" href="/">⧉ Agent OS</Link>
          <nav>{NAV.map(n => <Link key={n.href} href={n.href}>{n.label}</Link>)}</nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}

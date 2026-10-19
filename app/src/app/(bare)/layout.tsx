import type { MetadataRoute } from "next";

export const metadata = { title: "Pelago" };

// Bare root layout for the map iframe — no nav, no chrome, full-bleed.
export default function BareLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, padding: 0, overflow: "hidden", background: "#0a3a5c" }}>{children}</body>
    </html>
  );
}

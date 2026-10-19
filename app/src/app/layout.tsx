import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "Agent OS",
  description: "ניהול, משוב וכוונון הסוכן",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#0b1020", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}

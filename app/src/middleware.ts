import { NextRequest, NextResponse } from "next/server";

// Auth gate: no session cookie -> login page (API routes and static assets exempt;
// they enforce auth themselves).
const PUBLIC = ["/login", "/settings", "/manifest.webmanifest", "/icon.svg", "/pelago-placeholder.html"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api") || pathname.startsWith("/_next")) return NextResponse.next();
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (!req.cookies.get("agentos_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

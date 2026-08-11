import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { defaultLocale, isLocale } from "@/lib/i18n";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/health") return NextResponse.next();

  const forwardedLocale = request.headers.get("x-steinstossen-locale");
  if (isLocale(forwardedLocale)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const segments = pathname.split("/");
  const locale = segments[1];

  if (isLocale(locale)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-steinstossen-locale", locale);
    const rewritten = request.nextUrl.clone();
    rewritten.pathname = `/${segments.slice(2).join("/")}` || "/";
    return NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
  }

  const target = request.nextUrl.clone();
  target.pathname = pathname === "/" ? `/${defaultLocale}` : `/${defaultLocale}${pathname}`;
  return NextResponse.redirect(target);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};

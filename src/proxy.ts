import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");

  if (isApiAuth) return NextResponse.next();
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|favicon.ico|.*\\..*).*)"],
};
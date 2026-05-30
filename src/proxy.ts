import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === "/login" || pathname === "/signup";
  const isPasswordResetRoute = pathname === "/reset-password";
  const { response, user, profile } = await updateSupabaseSession(request);

  if (pathname.startsWith("/app") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isPasswordResetRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "Open the password reset link from your email first.");
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/app/admin") && profile?.is_admin !== true) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    (pathname.startsWith("/app/create") || pathname.startsWith("/app/dashboard")) &&
    profile?.wants_to_create_opportunities !== true
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/app/onboarding";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/app/applications") &&
    profile?.wants_to_join_opportunities === false
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login", "/signup", "/reset-password"],
};

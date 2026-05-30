import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfigOrThrow } from "@/lib/supabase/config";
import { getSiteUrl } from "@/lib/site-url";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/app";
  }

  return value;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const { url, anonKey } = getSupabaseConfigOrThrow();
  const cookieStore = await cookies();
  const redirectUrl = new URL(nextPath, getSiteUrl());
  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return response;
    }
  }

  const loginUrl = new URL("/login", getSiteUrl());
  loginUrl.searchParams.set("error", "We could not confirm your sign-in link.");
  return NextResponse.redirect(loginUrl);
}

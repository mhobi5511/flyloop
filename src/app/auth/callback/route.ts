import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseConfigOrThrow } from "@/lib/supabase/config";
import { getSiteUrl } from "@/lib/site-url";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/app";
  }

  return value;
}

function getConfirmedLoginUrl(origin: string) {
  const loginUrl = new URL("/login", getSiteUrl(origin));
  loginUrl.searchParams.set("confirmed", "true");
  return loginUrl;
}

function getFailureLoginUrl(origin: string) {
  const loginUrl = new URL("/login", getSiteUrl(origin));
  loginUrl.searchParams.set("error", "We could not confirm your sign-in link.");
  return loginUrl;
}

function getSuccessUrl(origin: string, nextPath: string, authType: string | null) {
  if (authType === "signup" || nextPath === "/app") {
    return getConfirmedLoginUrl(origin);
  }

  return new URL(nextPath, getSiteUrl(origin));
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const authType = requestUrl.searchParams.get("type");
  const hasAuthError =
    requestUrl.searchParams.has("error") ||
    requestUrl.searchParams.has("error_code") ||
    requestUrl.searchParams.has("error_description");
  const nextPath = getSafeNextPath(requestUrl.searchParams.get("next"));
  const { url, anonKey } = getSupabaseConfigOrThrow();
  const cookieStore = await cookies();
  const redirectUrl = getSuccessUrl(requestUrl.origin, nextPath, authType);
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

  if (tokenHash && authType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: authType as EmailOtpType,
    });

    if (!error) {
      return response;
    }
  }

  if (!hasAuthError && nextPath === "/app") {
    return response;
  }

  return NextResponse.redirect(getFailureLoginUrl(requestUrl.origin));
}

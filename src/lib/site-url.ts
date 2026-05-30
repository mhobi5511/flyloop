const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export function getSiteUrl(origin?: string) {
  const candidate = siteUrl || origin;
  const isProduction = process.env.NODE_ENV === "production";

  if (!candidate) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set for production auth redirects.",
    );
  }

  const parsed = new URL(candidate);
  const isLocalhost =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "::1";

  if (isProduction && (parsed.protocol !== "https:" || isLocalhost)) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be the production Flyloop HTTPS URL and must not point to localhost.",
    );
  }

  if (!isProduction && parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an http or https origin.");
  }

  return parsed.origin;
}

export function getAppUrl(path = "/app", origin?: string) {
  return new URL(path, getSiteUrl(origin)).toString();
}

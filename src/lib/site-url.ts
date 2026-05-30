const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export function getSiteUrl(origin?: string) {
  const candidate = siteUrl || origin;

  if (!candidate?.startsWith("https://")) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set to the production Flyloop HTTPS URL.",
    );
  }

  return candidate.replace(/\/+$/, "");
}

export function getAppUrl(path = "/app", origin?: string) {
  return new URL(path, getSiteUrl(origin)).toString();
}

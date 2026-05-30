const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

export function getSiteUrl() {
  if (!siteUrl?.startsWith("https://")) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set to the production Flyloop HTTPS URL.",
    );
  }

  return siteUrl.replace(/\/+$/, "");
}

export function getAppUrl(path = "/app") {
  return new URL(path, getSiteUrl()).toString();
}

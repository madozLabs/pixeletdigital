const LOCAL_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): URL {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const raw =
    configured || (vercelHost ? `https://${vercelHost}` : LOCAL_SITE_URL);
  try {
    return new URL(raw);
  } catch {
    return new URL(LOCAL_SITE_URL);
  }
}

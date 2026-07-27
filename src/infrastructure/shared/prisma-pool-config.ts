const LOCAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

export function resolvePrismaPoolMax({
  connectionString,
  configuredMax,
}: Readonly<{
  connectionString: string;
  configuredMax?: string;
}>): number | undefined {
  if (configuredMax !== undefined) {
    const parsed = Number(configuredMax);
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }

  try {
    const databaseUrl = new URL(connectionString);
    return LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname) ? 1 : undefined;
  } catch {
    return undefined;
  }
}

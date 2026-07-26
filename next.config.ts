import type { NextConfig } from "next";

const supabaseRemote = (() => {
  try {
    if (!process.env.SUPABASE_URL) return null;
    const url = new URL(process.env.SUPABASE_URL);
    return {
      protocol:
        url.protocol === "http:" ? ("http" as const) : ("https" as const),
      hostname: url.hostname,
    };
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1 MB; the media library and section editors upload
      // images/video/PDF directly through Server Actions.
      bodySizeLimit: "15mb",
    },
  },
  images: supabaseRemote
    ? {
        remotePatterns: [
          { ...supabaseRemote, pathname: "/storage/v1/object/public/**" },
        ],
      }
    : undefined,
};

export default nextConfig;

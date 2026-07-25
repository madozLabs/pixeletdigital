import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1 MB; the media library and section editors upload
      // images/video/PDF directly through Server Actions.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;

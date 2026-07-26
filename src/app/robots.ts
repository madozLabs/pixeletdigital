import type { MetadataRoute } from "next";
import { getSiteUrl } from "./_lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/workspace", "/login", "/api"],
    },
    sitemap: new URL("/sitemap.xml", getSiteUrl()).toString(),
  };
}

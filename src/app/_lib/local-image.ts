import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolves a file dropped in public/images/<worldSlug>/<name> to its public
 * URL, or null if it hasn't been added yet. Lets bespoke marketing pages
 * reference a fixed, documented filename and render a designed placeholder
 * until a real asset lands -- no upload flow, no CMS, no code change needed
 * to swap it in later.
 */
export function resolveLocalImage(relativePath: string): string | null {
  const normalized = relativePath.replace(/^\/+/, "");
  const absolute = path.join(process.cwd(), "public", "images", normalized);
  return existsSync(absolute) ? `/images/${normalized}` : null;
}

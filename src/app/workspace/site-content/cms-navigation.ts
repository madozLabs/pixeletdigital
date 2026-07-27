const PAGE_EDITOR_ROUTE = /^\/workspace\/site-content\/pages\/[^/]+\/edit\/?$/;

export function buildCmsWorldSwitchHref(
  pathname: string,
  nextWorld: string,
): string {
  const destination = PAGE_EDITOR_ROUTE.test(pathname)
    ? "/workspace/site-content/pages"
    : pathname;

  return `${destination}?world=${encodeURIComponent(nextWorld)}`;
}

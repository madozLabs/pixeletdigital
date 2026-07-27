import SiteContentPage from "../page";

export default async function CmsNavigationRoute({
  searchParams,
}: Readonly<{ searchParams: Promise<{ world?: string }> }>) {
  const params = await searchParams;
  return SiteContentPage({
    searchParams: Promise.resolve({ ...params, tab: "identity" }),
    standalone: true,
    identityFocus: "navigation",
  });
}

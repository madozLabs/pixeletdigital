import SiteContentPage from "../page";

export default async function CmsMediaRoute({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    world?: string;
    listPage?: string;
    q?: string;
    type?: string;
  }>;
}>) {
  const params = await searchParams;
  return SiteContentPage({
    searchParams: Promise.resolve({ ...params, tab: "media" }),
    standalone: true,
  });
}

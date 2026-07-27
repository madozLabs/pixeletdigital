import SiteContentPage from "../page";

export default async function CmsPagesRoute({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    world?: string;
    listPage?: string;
    notice?: string;
  }>;
}>) {
  const params = await searchParams;
  const content = await SiteContentPage({
    searchParams: Promise.resolve({ ...params, tab: "pages" }),
    standalone: true,
  });

  return (
    <>
      {params.notice === "page-unavailable" ? (
        <p className="feedback feedback--error" role="alert">
          Cette page n’est pas disponible dans le site sélectionné. Choisissez
          une page de cette liste.
        </p>
      ) : null}
      {content}
    </>
  );
}

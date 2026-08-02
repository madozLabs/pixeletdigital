import Link from "next/link";

export function Pagination({
  basePath,
  searchParams,
  page,
  totalPages,
  total,
}: Readonly<{
  basePath: string;
  searchParams: Readonly<Record<string, string | undefined>>;
  page: number;
  totalPages: number;
  total: number;
}>) {
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value);
    }
    params.set("listPage", String(targetPage));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <nav className="admin-pagination" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="admin-table__action">
          Précédent
        </Link>
      ) : (
        <span
          className="admin-table__action admin-table__action--disabled"
          aria-disabled="true"
        >
          Précédent
        </span>
      )}
      <span className="admin-pagination__status">
        Page {page} sur {totalPages} · {total} au total
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="admin-table__action">
          Suivant
        </Link>
      ) : (
        <span
          className="admin-table__action admin-table__action--disabled"
          aria-disabled="true"
        >
          Suivant
        </span>
      )}
    </nav>
  );
}

export const DEFAULT_PAGE_SIZE = 20;

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function parsePage(
  value: string | undefined,
  pageSize: number = DEFAULT_PAGE_SIZE,
): PageParams {
  const parsed = Number.parseInt(value ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  return { page, pageSize };
}

export function toSkipTake({ page, pageSize }: PageParams): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  params: PageParams,
): PaginatedResult<T> {
  const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
  return {
    items,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
  };
}

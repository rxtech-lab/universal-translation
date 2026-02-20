import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

function getPageNumbers(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [1];

  if (page > 3) pages.push("...");

  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (page < totalPages - 2) pages.push("...");

  pages.push(totalPages);
  return pages;
}

function pageHref(page: number) {
  if (page === 1) return "/dashboard/projects";
  return `/dashboard/projects?page=${page}`;
}

export function ProjectsPagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  return (
    <Pagination className="mt-4">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={page <= 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        {pages.map((p, i) =>
          p === "..." ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink href={pageHref(p)} isActive={p === page}>
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}

        <PaginationItem>
          <PaginationNext
            href={pageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={
              page >= totalPages ? "pointer-events-none opacity-50" : ""
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

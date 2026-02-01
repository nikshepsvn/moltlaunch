import { useState, useMemo } from 'react';
import { PER_PAGE } from '../lib/constants';

interface PaginationResult<T> {
  page: T[];
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

export function usePagination<T>(items: T[]): PaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  const page = useMemo(() => {
    const start = (safePage - 1) * PER_PAGE;
    return items.slice(start, start + PER_PAGE);
  }, [items, safePage]);

  // Reset to page 1 when items change significantly
  useMemo(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  return {
    page,
    currentPage: safePage,
    totalPages,
    goToPage: setCurrentPage,
    nextPage: () => setCurrentPage((p) => Math.min(p + 1, totalPages)),
    prevPage: () => setCurrentPage((p) => Math.max(p - 1, 1)),
  };
}

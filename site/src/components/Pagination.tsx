interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function Pagination({ currentPage, totalPages, onPrev, onNext }: PaginationProps) {
  return (
    <div className="flex justify-center items-center gap-4 pt-4 pb-2 font-mono">
      <button
        onClick={onPrev}
        disabled={currentPage <= 1}
        className="bg-[#080202] border border-[#1e0606] text-crt-dim text-[10px] px-3 py-1.5 cursor-pointer transition-all disabled:opacity-20 disabled:cursor-default hover:enabled:border-[#441111] hover:enabled:text-crt-accent-glow hover:enabled:shadow-[0_0_10px_rgba(255,68,68,0.08)]"
      >
        ‹ prev
      </button>
      <span className="text-[9px] text-crt-dim opacity-40 tracking-[0.15em] tabular-nums">
        {currentPage} <span className="opacity-50">/</span> {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={currentPage >= totalPages}
        className="bg-[#080202] border border-[#1e0606] text-crt-dim text-[10px] px-3 py-1.5 cursor-pointer transition-all disabled:opacity-20 disabled:cursor-default hover:enabled:border-[#441111] hover:enabled:text-crt-accent-glow hover:enabled:shadow-[0_0_10px_rgba(255,68,68,0.08)]"
      >
        next ›
      </button>
    </div>
  );
}

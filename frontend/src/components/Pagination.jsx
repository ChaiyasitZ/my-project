import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

// Available options for items per page
const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25, 50];

function Pagination({ 
  currentPage, 
  totalPages, 
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  showInfo = true,
  showPageSizeSelector = false
}) {
  if (totalPages <= 1 && !showPageSizeSelector) return null;

  const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-2">
      {/* Left side: Info and Page Size Selector */}
      <div className="flex items-center gap-4">
        {/* Page Size Selector */}
        {showPageSizeSelector && onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="pageSize" className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
              Show:
            </label>
            <select
              id="pageSize"
              value={itemsPerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="min-w-[60px] pl-2 pr-6 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300
                         focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                         appearance-none bg-no-repeat bg-right cursor-pointer"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundPosition: 'right 6px center'
              }}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        )}
        
        {/* Info */}
        {showInfo && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            Showing <span className="font-medium">{startItem}</span> to{' '}
            <span className="font-medium">{endItem}</span> of{' '}
            <span className="font-medium">{totalItems}</span> items
          </div>
        )}
      </div>
      
      {/* Page buttons */}
      <nav className="flex items-center gap-1" role="navigation" aria-label="Pagination">
        {/* Previous button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-md border border-gray-300 dark:border-gray-600 
                     hover:bg-gray-100 dark:hover:bg-gray-700 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     text-gray-700 dark:text-gray-300"
          title="Previous page"
          aria-label="Go to previous page"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        
        {/* Page numbers */}
        {getPageNumbers().map((page, index) => (
          page === '...' ? (
            <span 
              key={`ellipsis-${index}`} 
              className="px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`min-w-[28px] h-7 px-2 rounded-md border text-xs font-medium transition-colors
                ${currentPage === page 
                  ? 'bg-blue-600 border-blue-600 text-white' 
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              aria-label={`Go to page ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          )
        ))}
        
        {/* Next button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-md border border-gray-300 dark:border-gray-600 
                     hover:bg-gray-100 dark:hover:bg-gray-700 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     text-gray-700 dark:text-gray-300"
          title="Next page"
          aria-label="Go to next page"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}

export default Pagination;

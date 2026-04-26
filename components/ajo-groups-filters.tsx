'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';

export default function AjoGroupsFilters({ className }: { className?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Completed', value: 'completed' },
    { label: 'Upcoming', value: 'upcoming' },
  ];

  const selectedStatuses = useMemo(() => {
    const status = searchParams.get('status');
    return status ? status.split(',') : [];
  }, [searchParams]);

  /**
   * Updates the URL query parameters dynamically.
   * @param name - The parameter key (e.g., 'sort', 'status')
   * @param value - The parameter value (can be a string or array of strings)
   */
  const handleFilterChange = useCallback((name: string, value: string | string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params.set(name, value.join(','));
      } else {
        params.delete(name);
      }
    } else {
      if (value && value !== 'all') {
        params.set(name, value);
      } else {
        params.delete(name);
      }
    }

    // Reset pagination to page 1 when filters change
    params.delete('page');

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);

  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      <div className="w-[250px]">
        <MultiSelect
          options={statusOptions}
          selected={selectedStatuses}
          onChange={(values) => handleFilterChange('status', values)}
          placeholder="Filter by status"
          className="h-9"
        />
      </div>

      <select
        aria-label="Sort groups"
        onChange={(e) => handleFilterChange('sort', e.target.value)}
        defaultValue={searchParams.get('sort') || 'recent'}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <option value="recent">Most Recent</option>
        <option value="highest_pool">Highest Pool First</option>
        <option value="lowest_pool">Lowest Pool First</option>
      </select>
    </div>
  );
}
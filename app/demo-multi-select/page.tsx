'use client';

import { useState } from 'react';
import { MultiSelect } from '@/components/ui/multi-select';

const options = [
  { label: 'Active', value: 'active' },
  { label: 'Completed', value: 'completed' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Paused', value: 'paused' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function MultiSelectDemo() {
  const [selected, setSelected] = useState<string[]>(['active', 'upcoming']);

  return (
    <div className="p-8 max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Multi-Select Dropdown Demo</h1>
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Statuses</label>
        <MultiSelect
          options={options}
          selected={selected}
          onChange={setSelected}
          placeholder="Filter by status..."
        />
      </div>
      <div className="mt-4 p-4 border rounded bg-muted/50">
        <h2 className="text-sm font-semibold mb-2">Selected Values:</h2>
        <pre className="text-xs">{JSON.stringify(selected, null, 2)}</pre>
      </div>
    </div>
  );
}

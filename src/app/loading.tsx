import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-10 w-[200px]" />
        <Skeleton className="h-4 w-[300px] mt-2" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Skeleton className="col-span-4 h-[300px] w-full rounded-xl" />
        <Skeleton className="col-span-3 h-[300px] w-full rounded-xl" />
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-4 w-72 rounded-md" />
      </div>

      {/* Top summary cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>

      {/* Action cards skeleton */}
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36 rounded-lg" />
        <Skeleton className="h-36 rounded-lg" />
      </div>

      {/* Content panel / list skeleton */}
      <div className="border rounded-lg p-6 space-y-4 bg-card">
        <Skeleton className="h-6 w-44 rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

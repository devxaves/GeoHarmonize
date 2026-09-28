import { TableSkeleton } from "@/components/ui/loading-skeleton";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#fafaf9] py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-8 w-64 animate-pulse bg-slate-200 rounded-lg" />
        <TableSkeleton rows={8} />
      </div>
    </div>
  );
}

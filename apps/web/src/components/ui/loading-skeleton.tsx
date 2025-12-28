import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  type?: "card" | "table" | "list";
  count?: number;
  className?: string;
}

export function LoadingSkeleton({
  type = "card",
  count = 3,
  className,
}: LoadingSkeletonProps) {
  if (type === "card") {
    return (
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="border border-slate-200 rounded-lg p-4">
            <Skeleton className="h-5 w-3/4 mb-3" />
            <Skeleton className="h-4 w-1/2 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  // list type
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}


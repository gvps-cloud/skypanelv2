import { Card, CardContent, CardHeader } from "./card";
import { Skeleton } from "./skeleton";

interface MarketplaceCardSkeletonProps {
  className?: string;
}

export function MarketplaceCardSkeleton({ className }: MarketplaceCardSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
              <Skeleton className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-4" />
        </div>
        <Skeleton className="h-4 w-full mt-2" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

interface MarketplaceGridSkeletonProps {
  count?: number;
}

export function MarketplaceGridSkeleton({ count = 12 }: MarketplaceGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }, (_, index) => (
        <MarketplaceCardSkeleton key={`skeleton-${index}`} />
      ))}
    </div>
  );
}
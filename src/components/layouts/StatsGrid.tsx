import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
}

interface StatsGridProps {
  stats: StatCardProps[];
  columns?: 2 | 3 | 4 | 5 | 6;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  description,
  icon,
  trend
}) => {
  return (
    <Card className="overflow-hidden border-primary/20 bg-card/80">
      <CardContent className="relative min-h-[118px] p-4">
        <div className="absolute right-3 top-3 rounded-lg border border-primary/15 bg-primary/10 p-2 text-primary [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>

        <div className="flex min-h-[86px] min-w-0 flex-col justify-between pr-10">
          <div className="space-y-2">
            <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-semibold">{value}</p>
            {trend && (
              <div className={`flex items-center gap-1 text-xs ${
                trend.direction === 'up' ? 'text-emerald-500' : 'text-red-500'
              }`}>
                {trend.direction === 'up' ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(trend.value)}%
              </div>
            )}
            </div>
          </div>

          {description && (
            <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const StatsGrid: React.FC<StatsGridProps> = ({
  stats,
  columns = 4,
  className = ''
}) => {
  const gridCols = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 xl:grid-cols-3',
    4: 'sm:grid-cols-2 xl:grid-cols-4',
    5: 'sm:grid-cols-2 xl:grid-cols-5',
    6: 'sm:grid-cols-2 xl:grid-cols-6'
  };

  const gapClass = columns === 6 ? 'gap-3' : 'gap-4';

  return (
    <div className={`grid ${gapClass} ${gridCols[columns]} ${className}`}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};

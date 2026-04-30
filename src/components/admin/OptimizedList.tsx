import React from 'react';

interface OptimizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
  itemClassName?: string;
}

/**
 * Component for optimized list rendering
 */
function OptimizedListComponent<T>({
  items,
  renderItem,
  keyExtractor,
  className,
  itemClassName,
}: OptimizedListProps<T>) {
  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={keyExtractor(item, index)} className={itemClassName}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

export const OptimizedList = React.memo(OptimizedListComponent) as typeof OptimizedListComponent;
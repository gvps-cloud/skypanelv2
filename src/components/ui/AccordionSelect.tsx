import { useMemo, useState } from 'react';
import { Loader2, Search, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/**
 * Item within an accordion group
 */
export interface AccordionSelectItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  metadata?: string;
}

/**
 * A group of items that can be expanded/collapsed
 */
export interface AccordionSelectGroup {
  name: string;
  icon?: React.ReactNode;
  items: AccordionSelectItem[];
}

/**
 * Props for the AccordionSelect component
 */
export interface AccordionSelectProps {
  groups: Record<string, AccordionSelectGroup>;
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  disabled?: boolean;
  groupOrder?: string[];
  className?: string;
}

/**
 * Accordion Group Item Component
 *
 * A single expandable group with items.
 */
function AccordionGroupItem({
  group,
  selectedId,
  onItemSelect,
  defaultExpanded = false,
}: {
  group: AccordionSelectGroup;
  selectedId: string;
  onItemSelect: (id: string) => void;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Auto-expand if this group contains the selected item
  const hasSelectedItem = group.items.some(item => item.id === selectedId);
  if (hasSelectedItem && !isExpanded) {
    setIsExpanded(true);
  }

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Group Header - Clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {group.icon && <span className="flex-shrink-0">{group.icon}</span>}
          <span className="font-medium text-sm">{group.name}</span>
          <span className="text-xs text-muted-foreground">({group.items.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {hasSelectedItem && (
            <Check className="h-4 w-4 text-primary" />
          )}
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Items */}
      {isExpanded && (
        <div className="bg-muted/20">
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => !item.disabled && onItemSelect(item.id)}
              disabled={item.disabled}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                item.id === selectedId && "bg-primary/10 text-primary font-medium"
              )}
            >
              {item.icon && (
                <span className="flex-shrink-0">{item.icon}</span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate">{item.label}</span>
                  {item.metadata && (
                    <span className="text-xs text-muted-foreground">{item.metadata}</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                )}
              </div>
              {item.id === selectedId && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * AccordionSelect Component
 *
 * A searchable dropdown with expandable/collapsible groups.
 * Perfect for selecting items organized by category (e.g., regions by country, OS by distribution).
 *
 * Features:
 * - Collapsible groups (accordion style)
 * - Searchable/filterable
 * - Auto-expands groups containing selected items
 * - Custom icons and descriptions
 * - Loading and empty states
 * - Keyboard navigation support
 */
export function AccordionSelect({
  groups,
  selectedId,
  onSelect,
  placeholder,
  searchPlaceholder = "Search...",
  loading = false,
  loadingMessage = "Loading...",
  emptyMessage = "No items available",
  disabled = false,
  groupOrder,
  className,
}: AccordionSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get selected item for display
  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    for (const group of Object.values(groups)) {
      const item = group.items.find(i => i.id === selectedId);
      if (item) return { item, group };
    }
    return null;
  }, [selectedId, groups]);

  // Filter groups and items based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return groups;
    }

    const query = searchQuery.toLowerCase();
    const filtered: typeof groups = {};

    for (const [key, group] of Object.entries(groups)) {
      const matchingItems = group.items.filter(
        item =>
          item.label.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.metadata?.toLowerCase().includes(query) ||
          group.name.toLowerCase().includes(query)
      );

      if (matchingItems.length > 0) {
        filtered[key] = { ...group, items: matchingItems };
      }
    }

    return filtered;
  }, [groups, searchQuery]);

  // Get sorted group keys
  const sortedGroupKeys = useMemo(() => {
    const keys = Object.keys(filteredGroups);
    if (groupOrder) {
      return [
        ...groupOrder.filter(k => keys.includes(k)),
        ...keys.filter(k => !groupOrder?.includes(k)),
      ];
    }
    return keys;
  }, [filteredGroups, groupOrder]);

  // Trigger button content
  const triggerContent = selectedItem
    ? selectedItem.item.label
    : placeholder;

  // Show loading state
  if (loading && !selectedId) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground py-2", className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        {loadingMessage}
      </div>
    );
  }

  // Show empty state
  if (Object.keys(groups).length === 0) {
    return (
      <div className={cn("text-center py-4", className)}>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="flex items-center gap-2 min-w-0">
            {selectedItem?.item.icon && (
              <span className="flex-shrink-0">{selectedItem.item.icon}</span>
            )}
            <span className="truncate">{triggerContent}</span>
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="max-h-80 overflow-y-auto">
          {/* Search Input */}
          <div className="p-3 border-b sticky top-0 bg-background z-10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Groups */}
          {sortedGroupKeys.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No results found matching "{searchQuery}"
            </div>
          ) : (
            sortedGroupKeys.map((key) => (
              <AccordionGroupItem
                key={key}
                group={filteredGroups[key]}
                selectedId={selectedId}
                onItemSelect={(id) => {
                  onSelect(id);
                  setOpen(false);
                }}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

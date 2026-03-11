import React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableOption {
  value: string;
  label: string;
  description?: string;
  meta?: string;
  keywords?: string[];
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SearchableOptionSelectProps {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  helperText?: string;
  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  disabled?: boolean;
  ariaLabel?: string;
  triggerIcon?: React.ReactNode;
  triggerClassName?: string;
}

export function SearchableOptionSelect({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  helperText,
  loading = false,
  loadingMessage = "Loading options...",
  error,
  disabled = false,
  ariaLabel,
  triggerIcon,
  triggerClassName,
}: SearchableOptionSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const hasAvailableOptions = options.some((option) => !option.disabled);
  const isDisabled = disabled || loading || Boolean(error) || !hasAvailableOptions;

  const triggerLabel = selectedOption?.label
    ?? (loading ? loadingMessage : error ? "Unable to load options" : !hasAvailableOptions ? emptyMessage : placeholder);

  const statusMessage = error
    ?? (loading ? loadingMessage : !hasAvailableOptions ? emptyMessage : helperText);

  return (
    <div className="space-y-3">
      <Popover
        open={open && !isDisabled}
        onOpenChange={(nextOpen) => setOpen(nextOpen && !isDisabled)}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label={ariaLabel ?? placeholder}
            aria-expanded={open}
            disabled={isDisabled}
            className={cn(
              "h-auto w-full justify-between rounded-xl px-4 py-3 text-left font-normal",
              !selectedOption && "text-muted-foreground",
              triggerClassName,
            )}
          >
            <span className="flex min-w-0 items-start gap-3">
              {(selectedOption?.icon || triggerIcon) && (
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/70">
                  {selectedOption?.icon ?? triggerIcon}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{triggerLabel}</span>
                {selectedOption?.description && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {selectedOption.description}
                  </span>
                )}
              </span>
            </span>
            <ChevronsUpDown className="ml-3 h-4 w-4 shrink-0 text-muted-foreground/70" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-[min(36rem,calc(100vw-2rem))] p-0">
          <Command className="rounded-xl">
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList className="max-h-[340px]">
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup heading={`Options (${options.length})`}>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.description ?? ""} ${option.meta ?? ""} ${(option.keywords ?? []).join(" ")}`.trim()}
                    disabled={option.disabled}
                    className="items-start gap-3 px-3 py-3"
                    onSelect={() => {
                      if (option.disabled) return;
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    {option.icon && (
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/70">
                        {option.icon}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="truncate font-medium text-foreground">
                          {option.label}
                        </span>
                        {option.meta && (
                          <span className="shrink-0 text-xs font-medium text-muted-foreground">
                            {option.meta}
                          </span>
                        )}
                      </span>
                      {option.description && (
                        <span className="block text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </span>
                    <Check
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {statusMessage && (
        <p className={cn("text-xs text-muted-foreground", error && "text-destructive")}>
          {statusMessage}
        </p>
      )}
    </div>
  );
}
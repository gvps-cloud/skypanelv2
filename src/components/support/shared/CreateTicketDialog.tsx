import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Pagination from "@/components/ui/Pagination";
import { cn } from "@/lib/utils";
import { TicketCategory, TicketPriority } from "@/types/support";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Loader2,
  Server,
  Shield,
  Sparkles,
} from "lucide-react";

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTicketData) => Promise<void>;
  vpsInstances?: Array<{ id: string; label: string }>;
  isLoading?: boolean;
}

export interface CreateTicketData {
  subject: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
  vpsId?: string;
}

const STEPS = [
  { id: "details", label: "Issue Details", description: "Define the request" },
  { id: "service", label: "Service Context", description: "Attach a server" },
  { id: "review", label: "Review & Send", description: "Add final detail" },
] as const;

const CATEGORY_OPTIONS: Array<{ value: TicketCategory; label: string; description: string }> = [
  { value: "general", label: "General Inquiry", description: "Questions, guidance, or account help." },
  { value: "technical", label: "Technical Issue", description: "Problems with services, networking, or access." },
  { value: "billing", label: "Billing & Payments", description: "Invoices, balances, or payment concerns." },
  { value: "feature_request", label: "Feature Request", description: "Ideas that would improve your workflow." },
];

const PRIORITY_OPTIONS: Array<{ value: TicketPriority; label: string; description: string }> = [
  { value: "low", label: "Low", description: "A general question or non-urgent request." },
  { value: "medium", label: "Medium", description: "A normal issue that needs support attention." },
  { value: "high", label: "High", description: "Important functionality is degraded or blocked." },
  { value: "urgent", label: "Urgent", description: "A major outage or service-down scenario." },
];

const SERVICES_PER_PAGE = 8;

export const CreateTicketDialog: React.FC<CreateTicketDialogProps> = ({
  open,
  onOpenChange,
  onSubmit,
  vpsInstances = [],
  isLoading = false,
}) => {
  const [data, setData] = useState<CreateTicketData>({
    subject: "",
    description: "",
    priority: "medium",
    category: "general",
    vpsId: undefined,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePage, setServicePage] = useState(1);

  const busy = isLoading || submitting;
  const subjectReady = data.subject.trim().length > 0;
  const descriptionReady = data.description.trim().length > 0;

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    if (!query) return vpsInstances;
    return vpsInstances.filter((instance) => instance.label.toLowerCase().includes(query));
  }, [serviceSearch, vpsInstances]);

  const selectedService = useMemo(
    () => vpsInstances.find((instance) => instance.id === data.vpsId),
    [data.vpsId, vpsInstances]
  );

  const paginatedServices = useMemo(() => {
    const start = (servicePage - 1) * SERVICES_PER_PAGE;
    return filteredServices.slice(start, start + SERVICES_PER_PAGE);
  }, [filteredServices, servicePage]);

  useEffect(() => {
    if (open) {
      setData({
        subject: "",
        description: "",
        priority: "medium",
        category: "general",
        vpsId: undefined,
      });
      setCurrentStep(0);
      setServicePickerOpen(false);
      setServiceSearch("");
      setServicePage(1);
    }
  }, [open]);

  useEffect(() => {
    setServicePage(1);
  }, [serviceSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredServices.length / SERVICES_PER_PAGE));
    if (servicePage > totalPages) {
      setServicePage(totalPages);
    }
  }, [filteredServices.length, servicePage]);

  const handleDialogChange = (nextOpen: boolean) => {
    if (busy) return;
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectReady || !descriptionReady || busy) return;

    setSubmitting(true);
    try {
      await onSubmit(data);
    } finally {
      setSubmitting(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 0 && !subjectReady) return;
    setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1));
  };

  const previousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const selectedCategory = CATEGORY_OPTIONS.find((option) => option.value === data.category);
  const selectedPriority = PRIORITY_OPTIONS.find((option) => option.value === data.priority);

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="overflow-hidden border-border/60 bg-background p-0 shadow-2xl sm:max-w-3xl">
        <div className="relative">
          <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent" />

          <DialogHeader className="relative gap-5 border-b border-border/60 px-6 py-6 sm:px-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Guided ticket workflow
            </div>

            <div className="space-y-2">
              <DialogTitle className="text-2xl font-semibold tracking-tight">
                New Support Ticket
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-sm leading-relaxed">
                Create a ticket for your currently active organization. Add issue details,
                optionally link a service, then send a complete request to the support team.
              </DialogDescription>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isComplete = index < currentStep;

                return (
                  <div
                    key={step.id}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left transition-colors",
                      isActive && "border-primary/30 bg-primary/10 shadow-sm",
                      isComplete && "border-primary/20 bg-primary/5",
                      !isActive && !isComplete && "border-border/70 bg-card/70"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                          isActive && "border-primary/30 bg-primary text-primary-foreground",
                          isComplete && "border-primary/20 bg-primary/15 text-primary",
                          !isActive && !isComplete && "border-border bg-background text-muted-foreground"
                        )}
                      >
                        {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-0">
            <div className="space-y-6 px-6 py-6 sm:px-8">
              {currentStep === 0 && (
                <div className="grid gap-5 lg:grid-cols-[1.35fr_0.95fr]">
                  <div className="space-y-5 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm font-medium">
                        Subject <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="subject"
                        value={data.subject}
                        onChange={(e) => setData((current) => ({ ...current, subject: e.target.value }))}
                        placeholder="Brief summary of the issue"
                        className="h-11"
                        disabled={busy}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="category" className="text-sm font-medium">
                          Category
                        </Label>
                        <Select
                          value={data.category}
                          onValueChange={(value) =>
                            setData((current) => ({ ...current, category: value as TicketCategory }))
                          }
                          disabled={busy}
                        >
                          <SelectTrigger id="category" className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="priority" className="text-sm font-medium">
                          Priority
                        </Label>
                        <Select
                          value={data.priority}
                          onValueChange={(value) =>
                            setData((current) => ({ ...current, priority: value as TicketPriority }))
                          }
                          disabled={busy}
                        >
                          <SelectTrigger id="priority" className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-primary/15 bg-primary/5 p-5">
                    <div className="flex items-start gap-3">
                      <Shield className="mt-0.5 h-5 w-5 text-primary" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          Active organization context
                        </p>
                        <p className="text-sm text-muted-foreground">
                          This ticket will automatically be linked to the organization you
                          currently selected from the organizations area.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-xl border border-border/70 bg-background/80 p-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Selected category
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {selectedCategory?.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedCategory?.description}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Selected priority
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {selectedPriority?.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedPriority?.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 1 && (
                <div className="space-y-5 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Server className="h-4 w-4 text-primary" />
                      Related service
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Link a VPS if the request is tied to a specific server. This is optional,
                      and you can search through large server lists with pagination.
                    </p>
                  </div>

                  {vpsInstances.length > 0 ? (
                    <div className="space-y-4">
                      <Popover open={servicePickerOpen} onOpenChange={setServicePickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={servicePickerOpen}
                            disabled={busy}
                            className="h-12 w-full justify-between rounded-xl border-dashed px-4 text-left font-normal"
                          >
                            <span className="truncate text-sm">
                              {selectedService?.label || "Search and choose a related service (optional)"}
                            </span>
                            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-[min(36rem,calc(100vw-2rem))] p-0">
                          <Command shouldFilter={false} className="rounded-xl">
                            <CommandInput
                              placeholder="Search servers by label..."
                              value={serviceSearch}
                              onValueChange={setServiceSearch}
                            />
                            <CommandList className="max-h-[340px]">
                              <CommandGroup heading="Selection">
                                <CommandItem
                                  value="none"
                                  onSelect={() => {
                                    setData((current) => ({ ...current, vpsId: undefined }));
                                    setServicePickerOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "h-4 w-4",
                                      !data.vpsId ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  None / Not applicable
                                </CommandItem>
                              </CommandGroup>

                              <CommandSeparator />

                              {filteredServices.length > 0 ? (
                                <CommandGroup heading={`Servers (${filteredServices.length})`}>
                                  {paginatedServices.map((service) => (
                                    <CommandItem
                                      key={service.id}
                                      value={service.id}
                                      onSelect={() => {
                                        setData((current) => ({ ...current, vpsId: service.id }));
                                        setServicePickerOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "h-4 w-4",
                                          data.vpsId === service.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <span className="truncate">{service.label}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              ) : (
                                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                  No servers match your search.
                                </div>
                              )}
                            </CommandList>
                          </Command>

                          {filteredServices.length > 0 && (
                            <Pagination
                              currentPage={servicePage}
                              totalItems={filteredServices.length}
                              itemsPerPage={SERVICES_PER_PAGE}
                              onPageChange={setServicePage}
                              showItemsPerPage={false}
                              className="rounded-b-xl border-t bg-muted/10 px-4 py-3"
                            />
                          )}
                        </PopoverContent>
                      </Popover>

                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
                        <p className="font-medium text-foreground">Current selection</p>
                        <p className="mt-1 text-muted-foreground">
                          {selectedService
                            ? `This ticket will be linked to ${selectedService.label}.`
                            : "No VPS is linked yet. Choose one if the issue is service-specific."}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                      No VPS instances are currently available to attach. You can continue without
                      linking a service.
                    </div>
                  )}
                </div>
              )}

              {currentStep === 2 && (
                <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-3 rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm">
                    <Label htmlFor="description" className="text-sm font-medium">
                      Description <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      rows={9}
                      value={data.description}
                      onChange={(e) =>
                        setData((current) => ({ ...current, description: e.target.value }))
                      }
                      placeholder="Share the issue, the impact, any troubleshooting already tried, and what outcome you expect."
                      className="min-h-[220px] resize-none rounded-xl leading-relaxed"
                      disabled={busy}
                    />
                    <p className="text-xs text-muted-foreground">
                      Include steps to reproduce, relevant errors, or timing details to help the
                      support team respond faster.
                    </p>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-primary/15 bg-primary/5 p-5">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Ticket review</p>
                      <p className="text-sm text-muted-foreground">
                        Double-check the summary before sending it.
                      </p>
                    </div>

                    <div className="space-y-3 rounded-xl border border-border/70 bg-background/80 p-4 text-sm">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Subject
                        </p>
                        <p className="mt-1 font-medium text-foreground">
                          {data.subject || "Add a subject in step 1"}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Category
                          </p>
                          <p className="mt-1 text-foreground">{selectedCategory?.label}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Priority
                          </p>
                          <p className="mt-1 text-foreground">{selectedPriority?.label}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Related service
                        </p>
                        <p className="mt-1 text-foreground">
                          {selectedService?.label || "No linked service"}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Organization context
                        </p>
                        <p className="mt-1 text-foreground">Uses your active organization selection</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 border-t border-border/60 px-6 py-4 sm:justify-between sm:px-8">
              <div className="text-xs text-muted-foreground">
                Step {currentStep + 1} of {STEPS.length}
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                {currentStep === 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={previousStep} disabled={busy}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                )}

                {currentStep < STEPS.length - 1 ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    disabled={busy || (currentStep === 0 && !subjectReady)}
                  >
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={busy || !subjectReady || !descriptionReady}
                    className="min-w-[140px]"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Ticket"
                    )}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

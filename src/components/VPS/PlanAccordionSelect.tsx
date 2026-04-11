/**
 * PlanAccordionSelect Component
 *
 * A standardized accordion-style dropdown for selecting VPS plans.
 * Wraps the shared AccordionSelect component for consistent UI.
 */

import { useMemo } from 'react';
import { Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { AccordionSelect, type AccordionSelectGroup } from '@/components/ui/AccordionSelect';

export interface VPSPlan {
  id: string;
  label: string;
  vcpus: number;
  memory: number;
  disk: number;
  transfer: number;
  price?: {
    hourly: number;
    monthly: number;
  };
  type?: string;
}

/**
 * Format memory for display (MB to GB)
 */
function formatMemory(memoryMB: number): string {
  if (memoryMB >= 1024) {
    return `${Math.round(memoryMB / 1024)} GB`;
  }
  return `${memoryMB} MB`;
}

/**
 * Get plan tier for grouping
 */
function getPlanTier(plan: VPSPlan): string {
  const label = plan.label.toLowerCase();
  const type = plan.type?.toLowerCase() || '';

  if (label.includes('nanode') || type.includes('nanode')) return 'Nanode';
  if (label.includes('dedicated') || type.includes('dedicated')) return 'Dedicated';
  if (label.includes('high mem') || label.includes('highmem') || type.includes('highmem')) return 'High Memory';
  if (label.includes('gpu')) return 'GPU';
  return 'Standard';
}

/**
 * Get tier icon
 */
function getTierIcon(tier: string) {
  switch (tier) {
    case 'Nanode':
      return <Cpu className="h-4 w-4 text-green-500" />;
    case 'Dedicated':
      return <Cpu className="h-4 w-4 text-purple-500" />;
    case 'High Memory':
      return <MemoryStick className="h-4 w-4 text-blue-500" />;
    case 'GPU':
      return <Cpu className="h-4 w-4 text-orange-500" />;
    default:
      return <Cpu className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Convert plans list to AccordionSelectGroup format
 */
function plansToAccordionGroups(plans: VPSPlan[]): Record<string, AccordionSelectGroup> {
  // Group plans by tier
  const tierGroups: Record<string, VPSPlan[]> = {};

  for (const plan of plans) {
    const tier = getPlanTier(plan);
    if (!tierGroups[tier]) {
      tierGroups[tier] = [];
    }
    tierGroups[tier].push(plan);
  }

  // Convert to AccordionSelectGroup format
  const groups: Record<string, AccordionSelectGroup> = {};

  // Order tiers
  const tierOrder = ['Nanode', 'Standard', 'Dedicated', 'High Memory', 'GPU'];

  for (const tier of tierOrder) {
    if (tierGroups[tier]) {
      groups[tier] = {
        name: tier,
        icon: getTierIcon(tier),
        items: tierGroups[tier].map((plan) => ({
          id: plan.id,
          label: plan.label,
          description: `${plan.vcpus} vCPU, ${formatMemory(plan.memory)} RAM, ${Math.round(plan.disk / 1024)} GB Storage`,
          metadata: plan.price ? `$${plan.price.monthly.toFixed(2)}/mo` : undefined,
        })),
      };
    }
  }

  return groups;
}

interface PlanAccordionSelectProps {
  plans: VPSPlan[];
  selectedPlanId: string;
  onSelect: (planId: string) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * PlanAccordionSelect Component
 *
 * Displays VPS plans grouped by tier in an accordion-style dropdown.
 *
 * Features:
 * - Plans grouped by tier (Nanode, Standard, Dedicated, High Memory)
 * - Plan specs shown as description (vCPU, RAM, Storage)
 * - Price shown as metadata
 * - Search by plan name or specs
 * - Loading and empty states
 */
export function PlanAccordionSelect({
  plans,
  selectedPlanId,
  onSelect,
  loading = false,
  disabled = false,
  className,
}: PlanAccordionSelectProps) {
  const accordionGroups = useMemo(() => {
    return plansToAccordionGroups(plans);
  }, [plans]);

  // Order tiers
  const tierOrder = ['Nanode', 'Standard', 'Dedicated', 'High Memory', 'GPU'];

  return (
    <AccordionSelect
      groups={accordionGroups}
      selectedId={selectedPlanId}
      onSelect={onSelect}
      placeholder="Select a plan..."
      searchPlaceholder="Search plans by name, specs, or price..."
      loading={loading}
      loadingMessage="Loading plans..."
      emptyMessage="No plans available for this category and region."
      disabled={disabled}
      groupOrder={tierOrder}
      className={className}
    />
  );
}

/**
 * PlanSummary Component
 *
 * Displays selected plan details as badges.
 */
export function PlanSummary({ plan }: { plan: VPSPlan | null }) {
  if (!plan) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <div className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium">
        <Cpu className="inline h-3.5 w-3.5 mr-1" />
        {plan.vcpus} vCPU
      </div>
      <div className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium">
        <MemoryStick className="inline h-3.5 w-3.5 mr-1" />
        {formatMemory(plan.memory)} RAM
      </div>
      <div className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium">
        <HardDrive className="inline h-3.5 w-3.5 mr-1" />
        {Math.round(plan.disk / 1024)} GB Storage
      </div>
      <div className="rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium">
        {plan.transfer >= 1000 ? `${plan.transfer / 1000} TB` : `${plan.transfer} GB`} Transfer
      </div>
    </div>
  );
}

export default PlanAccordionSelect;

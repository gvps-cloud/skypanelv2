/**
 * ProviderAccordionSelect Component
 *
 * A standardized accordion-style dropdown for selecting cloud providers.
 * Wraps the shared AccordionSelect component for consistent UI.
 */

import { useMemo } from 'react';
import { Server } from 'lucide-react';
import { AccordionSelect, type AccordionSelectGroup } from '@/components/ui/AccordionSelect';
import type { Provider } from '@/types/provider';

/**
 * Get provider icon based on provider type
 */
function getProviderIcon(type: string) {
  switch (type?.toLowerCase()) {
    case 'linode':
      return (
        <img
          src="https://www.linode.com/wp-content/uploads/2021/01/Linode-Logo-Black.svg"
          alt="Linode"
          className="h-4 w-4 object-contain"
          onError={(e) => {
            e.currentTarget.src = 'https://cdn.simpleicons.org/linode/00A95C';
          }}
        />
      );
    case 'aws':
      return (
        <img
          src="https://cdn.simpleicons.org/aws/FF9900"
          alt="AWS"
          className="h-4 w-4 object-contain"
        />
      );
    case 'digitalocean':
      return (
        <img
          src="https://cdn.simpleicons.org/digitalocean/0080FF"
          alt="DigitalOcean"
          className="h-4 w-4 object-contain"
        />
      );
    case 'gcp':
      return (
        <img
          src="https://cdn.simpleicons.org/googlecloud/4285F4"
          alt="GCP"
          className="h-4 w-4 object-contain"
        />
      );
    case 'azure':
      return (
        <img
          src="https://cdn.simpleicons.org/microsoftazure/0078D4"
          alt="Azure"
          className="h-4 w-4 object-contain"
        />
      );
    default:
      return <Server className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * Convert providers list to AccordionSelectGroup format
 */
function providersToAccordionGroup(providers: Provider[]): Record<string, AccordionSelectGroup> {
  // Group providers by type
  const groups: Record<string, AccordionSelectGroup> = {};

  // Create a single "Providers" group for simplicity
  // Can be extended to group by type if needed
  const items = providers.map((provider) => ({
    id: provider.id,
    label: provider.name,
    description: provider.type.toUpperCase(),
    icon: getProviderIcon(provider.type),
  }));

  groups['providers'] = {
    name: 'Cloud Providers',
    icon: <Server className="h-4 w-4 text-muted-foreground" />,
    items,
  };

  return groups;
}

interface ProviderAccordionSelectProps {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelect: (providerId: string, provider: Provider) => void;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

/**
 * ProviderAccordionSelect Component
 *
 * Displays cloud providers in an accordion-style dropdown.
 *
 * Features:
 * - Provider icons (Linode, AWS, etc.)
 * - Provider type shown as description
 * - Search by provider name
 * - Loading and error states
 * - Auto-selects first provider on mount (handled by parent)
 */
export function ProviderAccordionSelect({
  providers,
  selectedProviderId,
  onSelect,
  loading = false,
  error = null,
  disabled = false,
  className,
}: ProviderAccordionSelectProps) {
  const accordionGroups = useMemo(() => {
    return providersToAccordionGroup(providers);
  }, [providers]);

  const handleSelect = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (provider) {
      onSelect(providerId, provider);
    }
  };

  const emptyMessage = error
    ? error
    : providers.length === 0
      ? "No active providers available. Please contact your administrator."
      : "No providers found matching your search.";

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-muted-foreground">
        Provider *
      </label>
      <AccordionSelect
        groups={accordionGroups}
        selectedId={selectedProviderId || ''}
        onSelect={handleSelect}
        placeholder="Select a cloud provider..."
        searchPlaceholder="Search providers..."
        loading={loading}
        loadingMessage="Loading providers..."
        emptyMessage={emptyMessage}
        disabled={disabled || !!error}
        className={className}
      />
      {selectedProviderId && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Server className="h-4 w-4" />
          <span>
            Selected:{' '}
            {providers.find((p) => p.id === selectedProviderId)?.name || selectedProviderId}
          </span>
        </div>
      )}
    </div>
  );
}

export default ProviderAccordionSelect;

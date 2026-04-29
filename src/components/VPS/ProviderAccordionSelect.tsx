/**
 * ProviderAccordionSelect Component
 *
 * A standardized accordion-style dropdown for selecting cloud providers.
 * Wraps the shared AccordionSelect component for consistent UI.
 */

import { useMemo, useState } from 'react';
import { Server } from 'lucide-react';
import { AccordionSelect, type AccordionSelectGroup } from '@/components/ui/AccordionSelect';
import type { Provider } from '@/types/provider';

const PROVIDER_LOGO_URLS: Record<string, string[]> = {
  linode: ['https://cdn.simpleicons.org/linode/00A95C', 'https://cdn.simpleicons.org/akamai/00A95C'],
  aws: ['https://cdn.simpleicons.org/amazonaws/FF9900', 'https://cdn.simpleicons.org/amazon/FF9900'],
  digitalocean: ['https://cdn.simpleicons.org/digitalocean/0080FF'],
  gcp: ['https://cdn.simpleicons.org/googlecloud/4285F4'],
  azure: ['https://cdn.simpleicons.org/microsoftazure/0078D4'],
};

/**
 * Get provider icon based on provider type
 */
function getProviderIcon(type: string) {
  const normalizedType = type?.toLowerCase();
  const urls = PROVIDER_LOGO_URLS[normalizedType];
  if (!urls || urls.length === 0) {
    return <Server className="h-4 w-4 text-muted-foreground" />;
  }

  return <ProviderImage urls={urls} alt={type} />;
}

function ProviderImage({ urls, alt }: { urls: string[]; alt: string }) {
  const [attempt, setAttempt] = useState(0);

  if (attempt >= urls.length) {
    return <Server className="h-4 w-4 text-muted-foreground" />;
  }

  return (
    <img
      src={urls[attempt]}
      alt={`${alt} logo`}
      className="h-4 w-4 object-contain flex-shrink-0"
      loading="lazy"
      onError={() => setAttempt((prev) => prev + 1)}
    />
  );
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

/**
 * OSAccordionSelect Component
 *
 * A standardized accordion-style dropdown for selecting OS images.
 * Wraps the shared AccordionSelect component for consistent UI.
 */

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { AccordionSelect, type AccordionSelectGroup } from '@/components/ui/AccordionSelect';
import { groupImagesByOS, OS_LOGO_MAP, OS_DISPLAY_ORDER, type ProviderImage } from '@/lib/osGroupUtils';

/**
 * OS Icon Component
 *
 * Displays OS logo from simpleicons.org with fallback to initials.
 */
function OSIcon({
  osKey,
  name,
  className,
}: {
  osKey: string;
  name: string;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = OS_LOGO_MAP[osKey];

  if (!imageUrl || imageFailed) {
    return (
      <span className={`text-xs font-semibold uppercase text-foreground/80 ${className}`}>
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`${name} logo`}
      className={`h-4 w-4 object-contain flex-shrink-0 ${className}`}
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
}

/**
 * Convert OS groups to AccordionSelectGroup format
 */
function osGroupsToAccordionGroups(osGroups: Record<string, any>): Record<string, AccordionSelectGroup> {
  const groups: Record<string, AccordionSelectGroup> = {};

  for (const [key, group] of Object.entries(osGroups)) {
    groups[key] = {
      name: group.name,
      icon: <OSIcon osKey={key} name={group.name} />,
      items: group.versions.map((v: any) => ({
        id: v.id,
        label: v.label,
      })),
    };
  }

  return groups;
}

interface OSAccordionSelectProps {
  images: Array<ProviderImage>;
  selectedImageId: string;
  onImageSelect: (imageId: string) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * OSAccordionSelect Component
 *
 * Displays OS images grouped by distribution in an expandable accordion format.
 *
 * Features:
 * - "None" option as default for no OS selected
 * - OS groups with icons (Ubuntu, Debian, CentOS, etc.)
 * - Search by OS name or version
 * - Auto-expands group containing selected image
 * - Loading and empty states
 * - Consistent with other AccordionSelect components
 */
export function OSAccordionSelect({
  images,
  selectedImageId,
  onImageSelect,
  loading = false,
  disabled = false,
  className,
}: OSAccordionSelectProps) {
  // Group images by OS distribution
  const osGroups = useMemo(() => {
    return groupImagesByOS(images);
  }, [images]);

  // Convert to AccordionSelect format with "None" option
  const accordionGroups = useMemo(() => {
    const groups = osGroupsToAccordionGroups(osGroups);

    // Add a "None" option at the top
    return {
      none: {
        name: 'Select OS',
        icon: <X className="h-4 w-4 text-muted-foreground" />,
        items: [
          {
            id: 'none',
            label: 'None',
            description: 'No operating system selected',
          },
        ],
      },
      ...groups,
    };
  }, [osGroups]);

  // Map empty selection to 'none'
  const effectiveSelectedId = selectedImageId || 'none';

  const handleSelect = (id: string) => {
    if (id === 'none') {
      onImageSelect('');
    } else {
      onImageSelect(id);
    }
  };

  return (
    <AccordionSelect
      groups={accordionGroups}
      selectedId={effectiveSelectedId}
      onSelect={handleSelect}
      placeholder="Select an operating system..."
      searchPlaceholder="Search operating systems..."
      loading={loading}
      loadingMessage="Loading operating systems..."
      emptyMessage="No operating systems available."
      disabled={disabled}
      groupOrder={['none', ...(OS_DISPLAY_ORDER as unknown as string[])]}
      className={className}
    />
  );
}

/**
 * LazyOSSelectionProps for the wizard version
 * This component wraps OSAccordionSelect for the VPS creation wizard.
 */
interface LazyOSSelectionProps {
  osGroups: Record<string, any>;
  selectedOSGroup: string | null;
  selectedOSVersion: Record<string, string>;
  onOSGroupSelect: (key: string) => void;
  onOSVersionSelect: (key: string, version: string) => void;
  onImageSelect: (imageId: string) => void;
  disabled?: boolean;
}

/**
 * LazyOSSelection Component
 *
 * VPS creation wizard version that handles the complex state management
 * of OS group and version selection.
 */
export function LazyOSSelection({
  osGroups,
  selectedOSGroup,
  selectedOSVersion,
  onOSGroupSelect,
  onOSVersionSelect,
  onImageSelect,
  disabled = false,
}: LazyOSSelectionProps) {
  // Get the actual selected image ID
  const selectedImageId = useMemo(() => {
    if (!selectedOSGroup || !selectedOSVersion[selectedOSGroup]) {
      return '';
    }
    return selectedOSVersion[selectedOSGroup];
  }, [selectedOSGroup, selectedOSVersion]);

  // Handle image selection
  const handleImageSelect = (imageId: string) => {
    if (imageId === '' || imageId === 'none') {
      // Clear selection
      onOSGroupSelect('');
      onOSVersionSelect('', '');
      onImageSelect('');
      return;
    }

    // Find which OS group this image belongs to
    for (const [key, group] of Object.entries(osGroups)) {
      if (group.versions.some((v: any) => v.id === imageId)) {
        onOSGroupSelect(key);
        onOSVersionSelect(key, imageId);
        break;
      }
    }
    onImageSelect(imageId);
  };

  // Convert osGroups to flat image list for OSAccordionSelect
  const flatImages = useMemo(() => {
    const images: ProviderImage[] = [];
    for (const group of Object.values(osGroups)) {
      for (const version of group.versions) {
        images.push({
          id: version.id,
          label: version.label,
        });
      }
    }
    return images;
  }, [osGroups]);

  return (
    <OSAccordionSelect
      images={flatImages}
      selectedImageId={selectedImageId}
      onImageSelect={handleImageSelect}
      disabled={disabled}
    />
  );
}

export default OSAccordionSelect;

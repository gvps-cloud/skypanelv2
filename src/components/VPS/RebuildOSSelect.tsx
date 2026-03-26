/**
 * RebuildOSSelect Component
 *
 * VPS rebuild dialog OS selection using the standardized AccordionSelect.
 * This is a thin wrapper around OSAccordionSelect for backward compatibility.
 */

import { OSAccordionSelect } from './OSAccordionSelect';
import type { ProviderImage } from '@/lib/osGroupUtils';

interface RebuildOSSelectProps {
  images: Array<ProviderImage>;
  selectedImageId: string;
  onImageSelect: (imageId: string) => void;
  loading?: boolean;
}

/**
 * RebuildOSSelect Component
 *
 * A searchable dropdown for selecting OS images during VPS rebuild.
 * Now uses the shared AccordionSelect component for consistent styling.
 *
 * Features:
 * - Collapsible OS groups (accordion style)
 * - Searchable/filterable
 * - OS icons for visual identification
 * - Selected image tracking
 * - Loading and empty states
 */
export default function RebuildOSSelect({
  images,
  selectedImageId,
  onImageSelect,
  loading = false,
}: RebuildOSSelectProps) {
  return (
    <OSAccordionSelect
      images={images}
      selectedImageId={selectedImageId}
      onImageSelect={onImageSelect}
      loading={loading}
    />
  );
}

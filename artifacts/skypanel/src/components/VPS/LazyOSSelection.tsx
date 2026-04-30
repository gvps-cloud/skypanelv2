/**
 * LazyOSSelection Component
 *
 * VPS creation wizard OS selection using the standardized AccordionSelect.
 * This is a thin wrapper around OSAccordionSelect for backward compatibility.
 */

import { LazyOSSelection as OSLazySelection } from './OSAccordionSelect';

interface OSGroup {
  name: string;
  key: string;
  versions: Array<{ id: string; label: string }>;
}

interface LazyOSSelectionProps {
  osGroups: Record<string, OSGroup>;
  selectedOSGroup: string | null;
  selectedOSVersion: Record<string, string>;
  onOSGroupSelect: (key: string) => void;
  onOSVersionSelect: (key: string, version: string) => void;
  onImageSelect: (imageId: string) => void;
}

/**
 * LazyOSSelection Component
 *
 * An accordion-style dropdown for selecting OS images during VPS creation.
 * Now uses the shared AccordionSelect component for consistent styling.
 *
 * This is the VPS creation wizard version - receives pre-grouped OS data from VPS.tsx.
 * For the rebuild dialog version, see RebuildOSSelect.tsx.
 *
 * Features:
 * - Collapsible OS groups (accordion style)
 * - Searchable/filterable
 * - OS icons for visual identification
 * - Selected state tracking
 * - Compatible with StackScript filtering
 */
export default function LazyOSSelection(props: LazyOSSelectionProps) {
  return <OSLazySelection {...props} />;
}

/**
 * LazyDeploymentSelection Component
 *
 * StackScript selection using the standardized AccordionSelect.
 * This is a thin wrapper around StackScriptAccordionSelect for backward compatibility.
 */

import { StackScriptAccordionSelect, type StackScript } from './StackScriptAccordionSelect';

interface LazyDeploymentSelectionProps {
  stackScripts: StackScript[];
  selectedStackScript: StackScript | null;
  onStackScriptSelect: (script: StackScript | null) => void;
}

/**
 * LazyDeploymentSelection Component
 *
 * An accordion-style dropdown for selecting StackScript deployments.
 * Now uses the shared AccordionSelect component for consistent styling.
 *
 * Features:
 * - "None" option for base OS provisioning
 * - Searchable/filterable StackScripts
 * - Script descriptions for context
 * - Filters out SSH helper scripts
 */
export default function LazyDeploymentSelection({
  stackScripts,
  selectedStackScript,
  onStackScriptSelect,
}: LazyDeploymentSelectionProps) {
  return (
    <StackScriptAccordionSelect
      stackScripts={stackScripts}
      selectedStackScript={selectedStackScript}
      onStackScriptSelect={onStackScriptSelect}
    />
  );
}

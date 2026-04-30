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

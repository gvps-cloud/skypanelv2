/**
 * StackScriptAccordionSelect Component
 *
 * A standardized accordion-style dropdown for selecting StackScripts.
 * Wraps the shared AccordionSelect component for consistent UI.
 */

import { useMemo } from 'react';
import { FileCode, X, Key } from 'lucide-react';
import { AccordionSelect, type AccordionSelectGroup } from '@/components/ui/AccordionSelect';

export interface StackScript {
  id: string;
  label: string;
  description?: string;
  user_defined_fields?: any[];
  images?: string[];
  stackscript_id?: number;
  slug?: string;
}

/**
 * Generate a unique key for StackScript deduplication
 */
function getScriptKey(script: StackScript, fallback: string): string {
  return [
    script.stackscript_id,
    script.id,
    script.slug,
    script.label,
    fallback,
  ]
    .filter((value) => value !== undefined && value !== null && String(value).length > 0)
    .map((value) => String(value))
    .join("-");
}

/**
 * Check if a script is the SSH helper script
 */
function isSshKeyScript(script: StackScript): boolean {
  return script.label === 'ssh-key' ||
    script.id === 'ssh-key' ||
    (script.label && script.label.toLowerCase().includes('ssh'));
}

/**
 * Convert StackScripts to AccordionSelectGroup format
 */
function stackScriptsToAccordionGroups(stackScripts: StackScript[]): {
  groups: Record<string, AccordionSelectGroup>;
  sshScript: StackScript | null;
} {
  // Find the SSH helper script (it's the default "None" selection)
  const sshScript = stackScripts.find(isSshKeyScript) || null;

  // Filter out duplicates (but keep other scripts)
  const seen = new Set<string>();
  const filteredScripts = stackScripts.filter((script, index) => {
    // Don't filter SSH script from the list - it should still be available
    // Just skip duplicates
    const key = getScriptKey(script, `${index}`);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  // Create a single "StackScripts" group for simplicity
  // Can be extended to group by category if needed
  const items = filteredScripts
    .filter(s => !isSshKeyScript(s)) // Exclude SSH from visible list
    .map((script) => ({
      id: script.id,
      label: script.label,
      description: script.description || 'Automated setup script',
    }));

  const groups: Record<string, AccordionSelectGroup> = {
    stackscripts: {
      name: 'StackScripts',
      icon: <FileCode className="h-4 w-4 text-muted-foreground" />,
      items: [
        {
          id: 'none',
          label: 'None',
          description: sshScript ? 'SSH key setup (default)' : 'Provision base OS without a deployment',
          icon: sshScript ? <Key className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-muted-foreground" />,
        },
        ...items,
      ],
    },
  };

  return { groups, sshScript };
}

interface StackScriptAccordionSelectProps {
  stackScripts: StackScript[];
  selectedStackScript: StackScript | null;
  onStackScriptSelect: (script: StackScript | null) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * StackScriptAccordionSelect Component
 *
 * Displays StackScripts in an accordion-style dropdown.
 *
 * Features:
 * - "None" option selects the SSH helper script for SSH key setup
 * - StackScript descriptions for context
 * - Search by name or description
 * - Loading and empty states
 */
export function StackScriptAccordionSelect({
  stackScripts,
  selectedStackScript,
  onStackScriptSelect,
  loading = false,
  disabled = false,
  className,
}: StackScriptAccordionSelectProps) {
  const { groups, sshScript } = useMemo(() => {
    return stackScriptsToAccordionGroups(stackScripts);
  }, [stackScripts]);

  // Get selected ID - use 'none' if null or if it's the SSH key script
  const selectedId = useMemo(() => {
    if (!selectedStackScript) {
      return 'none';
    }

    if (isSshKeyScript(selectedStackScript)) {
      return 'none';
    }

    return selectedStackScript.id;
  }, [selectedStackScript]);

  const handleSelect = (scriptId: string) => {
    if (scriptId === 'none') {
      // "None" actually selects the SSH helper script (for SSH key setup)
      onStackScriptSelect(sshScript);
      return;
    }

    const script = stackScripts.find((s) => s.id === scriptId);
    if (script) {
      onStackScriptSelect(script);
    }
  };

  return (
    <div className="space-y-2">
      <AccordionSelect
        groups={groups}
        selectedId={selectedId}
        onSelect={handleSelect}
        placeholder="Select a StackScript or None for SSH setup..."
        searchPlaceholder="Search StackScripts..."
        loading={loading}
        loadingMessage="Loading StackScripts..."
        emptyMessage="No StackScripts available."
        disabled={disabled}
        className={className}
      />
      {selectedStackScript && selectedId === 'none' && (
        <p className="text-xs text-muted-foreground">
          SSH key setup enabled
        </p>
      )}
      {selectedStackScript && selectedId !== 'none' && (
        <p className="text-xs text-muted-foreground">
          Selected: {selectedStackScript.label}
        </p>
      )}
    </div>
  );
}

export default StackScriptAccordionSelect;

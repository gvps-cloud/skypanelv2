import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface StackScript {
  id: string;
  label: string;
  description?: string;
  user_defined_fields?: any[];
  images?: string[];
  stackscript_id?: number;
  slug?: string;
}

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
  const getScriptKey = (script: StackScript, fallback: string) =>
    [
      script.stackscript_id,
      script.id,
      script.slug,
      script.label,
      fallback,
    ]
      .filter((value) => value !== undefined && value !== null && String(value).length > 0)
      .map((value) => String(value))
      .join("-");

  // Filter duplicates and suppress the SSH helper script from the grid
  const filteredStackScripts = useMemo(() => {
    const seen = new Set<string>();
    return stackScripts.filter((script, index) => {
      const isSshKeyScript = script.label === 'ssh-key' ||
        script.id === 'ssh-key' ||
        (script.label && script.label.toLowerCase().includes('ssh'));
      if (isSshKeyScript) {
        return false;
      }
      const key = getScriptKey(script, `${index}`);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [stackScripts]);

  const sshKeyScript = useMemo(() => {
    return stackScripts.find(script =>
      script.label === 'ssh-key' ||
      script.id === 'ssh-key' ||
      (script.label && script.label.toLowerCase().includes('ssh'))
    );
  }, [stackScripts]);

  const isNoneSelected = selectedStackScript === null ||
    (selectedStackScript && (
      selectedStackScript.label === 'ssh-key' ||
      selectedStackScript.id === 'ssh-key' ||
      (selectedStackScript.label && selectedStackScript.label.toLowerCase().includes('ssh'))
    ));

  const handleNoneSelect = () => {
    onStackScriptSelect(sshKeyScript || null);
  };

  const renderStackScripts = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* None option */}
      <div
        onClick={handleNoneSelect}
        className={cn(
          "relative p-3 min-h-[75px] border rounded-lg cursor-pointer transition-all touch-manipulation",
          isNoneSelected
            ? 'border-primary bg-primary/10 dark:bg-primary/20 dark:border-primary'
            : 'border hover:border-input dark:hover:border-gray-500'
        )}
      >
        <div className="flex flex-col space-y-2">
          <div className="w-9 h-9 bg-gray-400 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">NO</span>
          </div>
          <h4 className="font-medium text-foreground text-sm">None</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Provision base OS without a deployment
          </p>
        </div>
        {isNoneSelected && (
          <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>

      {/* Stack script options */}
      {filteredStackScripts.map((script, index) => {
        const isSelected = selectedStackScript?.id === script.id;

        return (
          <div
            key={getScriptKey(script, `${index}`)}
            onClick={() => onStackScriptSelect(script)}
            className={cn(
              "relative p-3 min-h-[75px] border rounded-lg cursor-pointer transition-all touch-manipulation",
              isSelected
                ? 'border-primary bg-primary/10 dark:bg-primary/20 dark:border-primary'
                : 'border hover:border-input dark:hover:border-gray-500'
            )}
          >
            <div className="flex flex-col space-y-2">
              <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">
                  {String(script.label || '').substring(0, 2).toUpperCase()}
                </span>
              </div>
              <h4 className="font-medium text-foreground text-sm truncate">
                {script.label}
              </h4>
              <p
                className="text-xs text-muted-foreground leading-relaxed overflow-hidden"
                style={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}
              >
                {script.description || 'Automated setup script'}
              </p>
            </div>
            {isSelected && (
              <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return <div className="space-y-4">{renderStackScripts()}</div>;
}

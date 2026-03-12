import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

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

const OS_LOGO_MAP: Record<string, string> = {
  ubuntu: 'https://cdn.simpleicons.org/ubuntu/E95420',
  debian: 'https://cdn.simpleicons.org/debian/A81D33',
  centos: 'https://cdn.simpleicons.org/centos/262577',
  rockylinux: 'https://cdn.simpleicons.org/rockylinux/10B981',
  almalinux: 'https://cdn.simpleicons.org/almalinux/3D5AFE',
  fedora: 'https://cdn.simpleicons.org/fedora/51A2DA',
  alpine: 'https://cdn.simpleicons.org/alpinelinux/0D597F',
  arch: 'https://cdn.simpleicons.org/archlinux/1793D1',
  opensuse: 'https://cdn.simpleicons.org/opensuse/73BA25',
  gentoo: 'https://cdn.simpleicons.org/gentoo/54487A',
  slackware: 'https://cdn.simpleicons.org/slackware/000000',
};

function OSIcon({
  osKey,
  name,
}: {
  osKey: string;
  name: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = OS_LOGO_MAP[osKey];

  if (!imageUrl || imageFailed) {
    return (
      <span className="text-xs font-semibold uppercase text-foreground/80">
        {name.slice(0, 2)}
      </span>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`${name} logo`}
      className="h-5 w-5 object-contain"
      loading="lazy"
      onError={() => setImageFailed(true)}
    />
  );
}

export default function LazyOSSelection({
  osGroups,
  selectedOSGroup,
  selectedOSVersion,
  onOSGroupSelect,
  onOSVersionSelect,
  onImageSelect
}: LazyOSSelectionProps) {
  // Memoize the filtered and sorted OS groups
  const sortedOSKeys = useMemo(() => {
    return ['ubuntu','debian','centos','rockylinux','almalinux','fedora','alpine','arch','opensuse','gentoo','slackware']
      .filter(key => osGroups[key] && osGroups[key].versions.length > 0);
  }, [osGroups]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {sortedOSKeys.map(key => {
        const group = osGroups[key];
        const selectedVersionId = selectedOSVersion[key] || group.versions[0]?.id;
        const isSelected = selectedOSGroup === key;
        
        return (
          <div
            key={key}
            className={cn(
              "p-3 min-h-[110px] border-2 rounded-lg transition-all cursor-pointer hover:shadow-md touch-manipulation",
              isSelected 
                ? 'border-primary bg-primary/10 dark:bg-primary/20 dark:border-primary' 
                : 'border hover:border-input dark:hover:border-gray-500'
            )}
            onClick={() => {
              onOSGroupSelect(key);
              const idToUse = selectedVersionId || group.versions[0]?.id;
              if (idToUse) onImageSelect(idToUse);
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                <div className="w-10 h-10 rounded-lg border border-border/70 bg-muted/50 flex items-center justify-center shadow-sm">
                  <OSIcon osKey={key} name={group.name} />
                </div>
                <h3 className="font-medium text-foreground text-sm lowercase truncate">
                  {group.name}
                </h3>
              </div>
              <div className="flex-shrink-0 ml-2">
                {isSelected ? (
                  <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-5 h-5 border-2 border-muted-foreground/30 rounded-full"></div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Select Version
              </label>
              <select
                value={selectedVersionId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  onOSVersionSelect(key, val);
                  onImageSelect(val);
                  onOSGroupSelect(key);
                }}
                className="w-full px-3 py-2.5 min-h-[40px] text-sm rounded-md border bg-secondary text-foreground shadow-sm focus:border-primary focus:ring-primary focus:outline-none focus:ring-2 touch-manipulation"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="" disabled>SELECT VERSION</option>
                {group.versions.map(v => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
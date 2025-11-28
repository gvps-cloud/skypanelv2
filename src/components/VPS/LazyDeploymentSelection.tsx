import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

interface StackScript {
  id: string;
  label: string;
  description?: string;
  user_defined_fields?: any[];
  images?: string[];
  isMarketplace?: boolean;
  appSlug?: string;
  stackscript_id?: number;
  slug?: string;
}

interface MarketplaceApp {
  slug: string;
  name: string;
  display_name?: string;
  description?: string;
  summary?: string;
  category?: string;
  deploy_count?: number;
  user_defined_fields?: any[];
  images?: string[];
  stackscript_id?: number;
}

interface LazyDeploymentSelectionProps {
  stackScripts: StackScript[];
  marketplaceApps?: MarketplaceApp[];
  selectedStackScript: StackScript | null;
  onStackScriptSelect: (script: StackScript | null) => void;
  marketplaceLoading?: boolean;
  marketplaceError?: string | null;
  onMarketplaceRefresh?: () => void;
}

export default function LazyDeploymentSelection({
  stackScripts,
  marketplaceApps = [],
  selectedStackScript,
  onStackScriptSelect,
  marketplaceLoading = false,
  marketplaceError = null,
  onMarketplaceRefresh = () => {}
}: LazyDeploymentSelectionProps) {
  const getScriptKey = (script: StackScript, fallback: string) =>
    [
      script.stackscript_id,
      script.id,
      script.slug,
      script.appSlug,
      script.label,
      fallback,
    ]
      .filter((value) => value !== undefined && value !== null && String(value).length > 0)
      .map((value) => String(value))
      .join("-");

  const getMarketplaceKey = (app: MarketplaceApp, fallback: string) =>
    [app.stackscript_id, app.slug, app.display_name, app.name, fallback]
      .filter((value) => value !== undefined && value !== null && String(value).length > 0)
      .map((value) => String(value))
      .join("-");

  const [activeTab, setActiveTab] = useState<'stackscripts' | 'marketplace'>('stackscripts');
  const [marketplaceSearch, setMarketplaceSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const uniqueMarketplaceApps = useMemo(() => {
    const seen = new Set<string>();
    return marketplaceApps.filter((app, index) => {
      const key = getMarketplaceKey(app, `${index}`);
      if (!key) return false;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [marketplaceApps]);

  const categoryOptions = useMemo(() => {
    const categories = new Set<string>();
    uniqueMarketplaceApps.forEach((app) => {
      if (app.category) {
        categories.add(app.category);
      }
    });
    return Array.from(categories).sort((a, b) => a.localeCompare(b));
  }, [uniqueMarketplaceApps]);

  const visibleMarketplaceApps = useMemo(() => {
    const searchTerm = marketplaceSearch.trim().toLowerCase();
    return uniqueMarketplaceApps.filter((app) => {
      const matchesSearch =
        searchTerm.length === 0 ||
        `${app.display_name || app.name} ${app.description || ''}`
          .toLowerCase()
          .includes(searchTerm);
      const matchesCategory =
        categoryFilter === 'all' ||
        (app.category || '').toLowerCase() === categoryFilter.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [uniqueMarketplaceApps, marketplaceSearch, categoryFilter]);

  const hasMarketplace = (uniqueMarketplaceApps?.length ?? 0) > 0 || marketplaceLoading || Boolean(marketplaceError);

  useEffect(() => {
    if (selectedStackScript?.isMarketplace) {
      setActiveTab('marketplace');
    } else if (!hasMarketplace) {
      setActiveTab('stackscripts');
    }
  }, [selectedStackScript, hasMarketplace]);

  // Memoize filtered stack scripts to avoid recalculation
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

  // Memoize SSH key script detection
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

  const handleMarketplaceSelect = (app: MarketplaceApp) => {
    onStackScriptSelect({
      id: app.slug,
      label: app.display_name || app.name,
      description: app.description || app.summary,
      user_defined_fields: app.user_defined_fields || [],
      images: app.images || [],
      isMarketplace: true,
      appSlug: app.slug,
    });
  };

  const renderMarketplaceCards = () => {
    if (marketplaceLoading) {
      return (
        <div className="p-4 border rounded-lg text-sm text-muted-foreground">
          Loading marketplace applications…
        </div>
      );
    }

    if (marketplaceError) {
      return (
        <div className="p-4 border rounded-lg text-sm text-muted-foreground space-y-3">
          <p>{marketplaceError}</p>
          <button
            type="button"
            onClick={onMarketplaceRefresh}
            className="text-primary underline-offset-4 hover:underline"
          >
            Retry loading marketplace apps
          </button>
        </div>
      );
    }

    if (!visibleMarketplaceApps || visibleMarketplaceApps.length === 0) {
      return (
        <div className="p-4 border rounded-lg text-sm text-muted-foreground">
          No marketplace applications match your filters.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleMarketplaceApps.map((app, index) => {
          const isSelected =
            selectedStackScript?.isMarketplace &&
            selectedStackScript?.appSlug === app.slug;
          return (
            <div
              key={getMarketplaceKey(app, `${index}`)}
              onClick={() => handleMarketplaceSelect(app)}
              className={cn(
                "relative p-3 min-h-[75px] border rounded-lg cursor-pointer transition-all touch-manipulation",
                isSelected
                  ? 'border-primary bg-primary/10 dark:bg-primary/20 dark:border-primary'
                  : 'border hover:border-input dark:hover:border-gray-500'
              )}
            >
              <div className="flex flex-col space-y-2">
                <div className="w-9 h-9 bg-gradient-to-br from-orange-500 to-rose-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">
                    {(app.display_name || app.name || 'MP').substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <h4 className="font-medium text-foreground text-sm truncate">
                  {app.display_name || app.name}
                </h4>
                <p
                  className="text-xs text-muted-foreground leading-relaxed overflow-hidden"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {app.description || app.summary || 'Marketplace application'}
                </p>
                <div className="text-xs text-muted-foreground">
                  {app.category || 'Applications'}
                </div>
              </div>
              {isSelected && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {hasMarketplace && (
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-4 space-y-3 bg-[hsl(var(--background))] border-b border-border/30">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('stackscripts')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md border",
                activeTab === 'stackscripts'
                  ? 'border-primary text-primary bg-primary/10 dark:bg-primary/20'
                  : 'border text-muted-foreground bg-secondary hover:bg-secondary/80'
              )}
            >
              StackScripts
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('marketplace')}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md border",
                activeTab === 'marketplace'
                  ? 'border-primary text-primary bg-primary/10 dark:bg-primary/20'
                  : 'border text-muted-foreground bg-secondary hover:bg-secondary/80'
              )}
            >
              Marketplace
            </button>
          </div>

          {activeTab === 'marketplace' && (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={marketplaceSearch}
                  onChange={(event) => setMarketplaceSearch(event.target.value)}
                  placeholder="Search marketplace apps..."
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Category</label>
                <Select
                  value={categoryFilter}
                  onValueChange={(value) => setCategoryFilter(value)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'marketplace' && hasMarketplace ? renderMarketplaceCards() : renderStackScripts()}
    </div>
  );
}

'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Globe, Zap, Server, CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CountryFlag } from '@/components/regions/RegionMarker';
import { Link } from 'react-router-dom';

interface RegionData {
  id: string;
  label: string;
  country: string;
  status: string;
  site_type: string;
  displayLabel?: string;
  displayCountry?: string;
  speedTestUrl?: string;
  capabilities?: string[];
}

interface GlobeRegionPanelProps {
  region: RegionData | null;
  onClose: () => void;
}

export default function GlobeRegionPanel({ region, onClose }: GlobeRegionPanelProps) {
  if (!region) return null;

  // Get capability labels for display
  const capabilityLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    'Block Storage': { label: 'Block Storage', icon: <Server className="h-3 w-3" /> },
    'Cloud Firewall': { label: 'Cloud Firewall', icon: <Zap className="h-3 w-3" /> },
    'NodeBalancers': { label: 'NodeBalancers', icon: <Globe className="h-3 w-3" /> },
    'GPU Linodes': { label: 'GPU Instances', icon: <Zap className="h-3 w-3" /> },
    'Kubernetes': { label: 'Kubernetes', icon: <Server className="h-3 w-3" /> },
    'Premium Plans': { label: 'Premium Plans', icon: <Zap className="h-3 w-3" /> },
    'Nanode': { label: 'Nanode Plans', icon: <Server className="h-3 w-3" /> },
  };

  return (
    <AnimatePresence>
      {region && (
        <motion.div
          initial={{ opacity: 0, x: 40, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 40, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="absolute right-0 top-1/2 -translate-y-1/2 w-[280px] md:w-[340px] max-h-[80vh] overflow-auto home-glass-panel border-primary/20"
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <CountryFlag countryCode={region.country?.toLowerCase() || ''} size={20} />
                  <span>{region.displayLabel || region.label}</span>
                </h3>
                <p className="text-sm text-muted-foreground">
                  {region.displayCountry || region.country}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
              aria-label="Close panel"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Status Badge */}
          <div className="mb-4">
            <Badge
              variant="outline"
              className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary"
            >
              <CheckCircle2 className="h-3 w-3 mr-1.5" />
              Available
            </Badge>
          </div>

          {/* Location Details */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
              <MapPin className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Location</p>
                <p className="text-sm font-medium">{region.displayCountry || region.country}</p>
              </div>
            </div>

            {region.site_type && region.site_type !== 'core' && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Zap className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Site Type</p>
                  <p className="text-sm font-medium capitalize">{region.site_type.replace('-', ' ')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Capabilities */}
          {region.capabilities && region.capabilities.length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Features</p>
              <div className="flex flex-wrap gap-2">
                {region.capabilities.slice(0, 6).map((cap) => {
                  const capability = capabilityLabels[cap];
                  return (
                    <Badge
                      key={cap}
                      variant="secondary"
                      className="rounded-full px-3 py-1 bg-primary/10 text-primary border-primary/20"
                    >
                      {capability?.icon}
                      <span className="ml-1.5">{capability?.label || cap}</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-3 border-t border-border/50">
            <Button
              className="w-full h-11 group"
              asChild
            >
              <Link to={`/vps?region=${region.id}`}>
                Deploy to this Region
                <ExternalLink className="h-4 w-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="w-full h-10"
              onClick={onClose}
            >
              Close
            </Button>
          </div>

          {/* Region ID Footer */}
          <p className="text-[10px] text-muted-foreground/50 text-center mt-4">
            Region ID: {region.id}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

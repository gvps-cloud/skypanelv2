import { ServerCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WebserverKind, WebserverToolCapabilities } from "./webserverTools";
import { WEBSERVER_KIND_LABELS } from "./webserverTools";

interface Props {
  kind: WebserverKind;
  capabilities: WebserverToolCapabilities;
}

export default function WebserverProfileCard({ kind, capabilities }: Props) {
  const tools = [
    capabilities.rewritesMode === "webserver" ? "Webserver rewrites" : null,
    capabilities.rewritesMode === "htaccess" ? ".htaccess rewrites" : null,
    capabilities.htaccessIps ? ".htaccess IP rules" : null,
    capabilities.nginxFastCgi ? "FastCGI cache" : null,
    capabilities.modSecurity ? "ModSecurity" : null,
    capabilities.lsphpSettings ? "LSPHP" : null,
    capabilities.vhostWebserver ? "Custom vhost" : null,
  ].filter(Boolean);

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 py-4 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground sm:text-lg">
              <ServerCog className="h-5 w-5 text-primary" />
              <span>Detected Web Server</span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Tools below are selected from the Enhance webserver kind for this website.
            </p>
          </div>
          <Badge variant={kind === "unknown" || kind === "dummyWebServer" ? "secondary" : "default"}>
            {WEBSERVER_KIND_LABELS[kind]}
          </Badge>
        </div>
      </div>
      <div className="px-6 py-5 sm:px-8 sm:py-6">
        {tools.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <Badge key={tool} variant="secondary">{tool}</Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No customer-safe web server tools are available for this detected web server kind.
          </p>
        )}
      </div>
    </section>
  );
}

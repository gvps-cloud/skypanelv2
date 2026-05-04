export type WebserverKind = "liteSpeed" | "openLiteSpeed" | "dummyWebServer" | "apache" | "nginx" | "unknown";

export interface WebserverToolCapabilities {
  rewritesMode: "htaccess" | "webserver" | null;
  htaccessIps: boolean;
  nginxFastCgi: boolean;
  modSecurity: boolean;
  lsphpSettings: boolean;
  vhostWebserver: "apache" | "nginx" | null;
}

export const WEBSERVER_KIND_LABELS: Record<WebserverKind, string> = {
  apache: "Apache",
  nginx: "Nginx",
  liteSpeed: "LiteSpeed",
  openLiteSpeed: "OpenLiteSpeed",
  dummyWebServer: "No web server",
  unknown: "Unknown web server",
};

export function normalizeWebserverKind(kind: unknown): WebserverKind {
  return kind === "apache" || kind === "nginx" || kind === "liteSpeed" || kind === "openLiteSpeed" || kind === "dummyWebServer"
    ? kind
    : "unknown";
}

export function getWebserverToolCapabilities(kind: WebserverKind): WebserverToolCapabilities {
  switch (kind) {
    case "nginx":
      return {
        rewritesMode: "webserver",
        htaccessIps: false,
        nginxFastCgi: true,
        modSecurity: true,
        lsphpSettings: false,
        vhostWebserver: "nginx",
      };
    case "apache":
      return {
        rewritesMode: "htaccess",
        htaccessIps: true,
        nginxFastCgi: false,
        modSecurity: true,
        lsphpSettings: false,
        vhostWebserver: "apache",
      };
    case "liteSpeed":
    case "openLiteSpeed":
      return {
        rewritesMode: "htaccess",
        htaccessIps: true,
        nginxFastCgi: false,
        modSecurity: true,
        lsphpSettings: true,
        vhostWebserver: null,
      };
    default:
      return {
        rewritesMode: null,
        htaccessIps: false,
        nginxFastCgi: false,
        modSecurity: false,
        lsphpSettings: false,
        vhostWebserver: null,
      };
  }
}

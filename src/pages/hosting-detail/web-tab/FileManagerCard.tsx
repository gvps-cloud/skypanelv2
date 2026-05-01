import { FolderOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  filerdAddress?: string;
  enhanceApiUrl?: string;
}

export default function FileManagerCard({ filerdAddress, enhanceApiUrl }: Props) {
  const baseUrl = enhanceApiUrl || "https://cp.gvps.cloud";

  const handleOpen = () => {
    if (!filerdAddress) return;
    const url = filerdAddress.startsWith("http")
      ? filerdAddress
      : `${baseUrl.replace(/\/api$/, "")}${filerdAddress}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="rounded-2xl border bg-card shadow-sm">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
          <FolderOpen className="h-5 w-5 text-primary" />
          <span>File Manager</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Open the Enhance file manager to browse and manage website files.
        </p>
      </div>
      <div className="px-6 sm:px-8 py-5 sm:py-6">
        {filerdAddress ? (
          <Button onClick={handleOpen}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open File Manager
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">File manager is not available for this website.</p>
        )}
      </div>
    </section>
  );
}

import { useEffect, useState } from "react";
import {
  Loader2,
  Shield,
  ShieldCheck,
  Upload,
  Lock,
  Unlock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import MailSslCard from "./ssl-tab/MailSslCard";

interface Domain {
  id: string;
  domain: string;
  sslActive?: boolean;
  forceSsl?: boolean;
}

interface DomainSslStatus {
  sslActive: boolean;
  forceSsl: boolean;
}

interface SslTabProps {
  subscriptionId: string;
}

export default function SslTab({ subscriptionId }: SslTabProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sslStatusMap, setSslStatusMap] = useState<Record<string, DomainSslStatus>>({});
  const [generatingDomainId, setGeneratingDomainId] = useState<string | null>(null);
  const [togglingDomainId, setTogglingDomainId] = useState<string | null>(null);

  const [uploadDomain, setUploadDomain] = useState<Domain | null>(null);
  const [certText, setCertText] = useState("");
  const [keyText, setKeyText] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchDomains = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<{ domains?: Domain[] }>(
        `/hosting/dns/${subscriptionId}/domains?withSsl=true`
      );
      const list = data.domains || [];
      setDomains(list);

      const initialMap: Record<string, DomainSslStatus> = {};
      for (const d of list) {
        initialMap[d.id] = {
          sslActive: Boolean(d.sslActive),
          forceSsl: Boolean(d.forceSsl),
        };
      }
      setSslStatusMap(initialMap);
    } catch (err: any) {
      setError(err?.message || "Failed to load domains");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!subscriptionId) return;
    fetchDomains();
  }, [subscriptionId]);

  const handleGenerate = async (domainId: string) => {
    try {
      setGeneratingDomainId(domainId);
      const res = await apiClient.post<{ success?: boolean; message?: string }>(
        `/hosting/ssl/${subscriptionId}/domains/${domainId}/ssl`
      );
      toast.success(res.message || "SSL certificate generated");
      await fetchDomains();
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate SSL certificate");
    } finally {
      setGeneratingDomainId(null);
    }
  };

  const handleToggleForceSsl = async (domainId: string, enabled: boolean) => {
    try {
      setTogglingDomainId(domainId);
      const res = await apiClient.put<{ success?: boolean; message?: string }>(
        `/hosting/ssl/${subscriptionId}/domains/${domainId}/force_ssl`,
        { enabled }
      );
      toast.success(res.message || `Force SSL ${enabled ? "enabled" : "disabled"}`);
      setSslStatusMap((prev) => ({
        ...prev,
        [domainId]: { ...(prev[domainId] || { sslActive: false }), forceSsl: enabled },
      }));
    } catch (err: any) {
      toast.error(err?.message || "Failed to update Force SSL setting");
    } finally {
      setTogglingDomainId(null);
    }
  };

  const openUpload = (domain: Domain) => {
    setUploadDomain(domain);
    setCertText("");
    setKeyText("");
  };

  const handleUpload = async () => {
    if (!uploadDomain) return;
    if (!certText.trim() || !keyText.trim()) {
      toast.error("Certificate and private key are required");
      return;
    }
    try {
      setUploading(true);
      const res = await apiClient.post<{ success?: boolean; message?: string }>(
        `/hosting/ssl/${subscriptionId}/domains/${uploadDomain.id}/ssl/upload`,
        { cert: certText.trim(), key: keyText.trim() }
      );
      toast.success(res.message || "Custom certificate uploaded");
      setUploadDomain(null);
      await fetchDomains();
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload certificate");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : domains.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No domains found for this subscription.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {domains.map((domain) => {
            const status = sslStatusMap[domain.id] || {
              sslActive: false,
              forceSsl: false,
            };
            return (
              <Card key={domain.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {status.sslActive ? (
                        <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      )}
                      <CardTitle className="text-base">{domain.domain}</CardTitle>
                    </div>
                    <Badge
                      variant={status.sslActive ? "default" : "secondary"}
                      className={cn(
                        status.sslActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200"
                          : undefined
                      )}
                    >
                      {status.sslActive ? "SSL Active" : "SSL Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>
                    Manage SSL certificates and HTTPS enforcement.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3">
                    <Button
                      size="sm"
                      onClick={() => handleGenerate(domain.id)}
                      disabled={generatingDomainId === domain.id}
                    >
                      {generatingDomainId === domain.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" />
                      )}
                      Generate Let&apos;s Encrypt
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openUpload(domain)}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Custom Certificate
                    </Button>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      {status.forceSsl ? (
                        <Lock className="h-4 w-4 text-primary" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">Force SSL</span>
                    </div>
                    <Switch
                      checked={status.forceSsl}
                      onCheckedChange={(checked) =>
                        handleToggleForceSsl(domain.id, checked)
                      }
                      disabled={togglingDomainId === domain.id}
                      aria-label="Toggle Force SSL"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Custom Cert Dialog */}
      <Dialog
        open={!!uploadDomain}
        onOpenChange={(open) => {
          if (!open) setUploadDomain(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Custom Certificate</DialogTitle>
            <DialogDescription>
              Paste your certificate and private key for{" "}
              <span className="font-medium">{uploadDomain?.domain}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Certificate (PEM)</label>
              <Textarea
                value={certText}
                onChange={(e) => setCertText(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
                rows={6}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Private Key (PEM)</label>
              <Textarea
                value={keyText}
                onChange={(e) => setKeyText(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUploadDomain(null)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Upload Certificate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Mail SSL Section */}
      <MailSslCard subscriptionId={subscriptionId} domains={domains} />
    </div>
  );
}

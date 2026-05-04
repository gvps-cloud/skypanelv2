import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Domain {
  id: string;
  domain: string;
  is_primary?: boolean;
}

interface Props {
  subscriptionId: string;
  domains: Domain[];
}

export default function MailSslCard({ subscriptionId, domains }: Props) {
  const [selectedDomainId, setSelectedDomainId] = useState<string>("");
  const [issuing, setIssuing] = useState(false);

  useEffect(() => {
    if (domains.length === 0) {
      setSelectedDomainId("");
      return;
    }
    const exists = domains.some((d) => d.id === selectedDomainId);
    if (!exists) setSelectedDomainId(domains[0].id);
  }, [domains, selectedDomainId]);

  const handleIssue = async () => {
    if (!selectedDomainId) return;
    const domain = domains.find((d) => d.id === selectedDomainId);
    if (!confirm(`Issue a Let's Encrypt certificate for mail.${domain?.domain}?`)) return;
    setIssuing(true);
    try {
      await apiClient.post(`/hosting/web/${subscriptionId}/domains/${selectedDomainId}/mail-ssl`);
      toast.success("Mail SSL certificate generation started. This may take a few minutes.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to issue mail SSL");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <section className="rounded-2xl cyber-card cyber-card--hover">
      <div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
        <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
          <Mail className="h-5 w-5 text-primary" />
          <span>Mail Domain SSL</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Issue Let&apos;s Encrypt for the mail host <span className="font-medium">mail.</span> plus each mapped hostname below (primary, aliases, preview/staging).
        </p>
      </div>
      <div className="px-6 sm:px-8 py-5 sm:py-6">
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label>Domain</Label>
            <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a domain" />
              </SelectTrigger>
              <SelectContent>
                {domains.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    mail.{d.domain}
                    {d.is_primary ? " (Primary)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleIssue} disabled={issuing || !selectedDomainId}>
            {issuing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Issue Mail SSL
          </Button>
        </div>
      </div>
    </section>
  );
}

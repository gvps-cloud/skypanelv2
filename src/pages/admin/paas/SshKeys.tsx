import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Key, Plus, RefreshCw, Trash2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { PageHeader } from "@/components/layouts/PageHeader";
import { ContentCard } from "@/components/layouts/ContentCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface SshKey {
  id: string;
  name: string;
  publicKey: string;
  keyPath: string;
  fingerprint: string;
  usedByWorkers: number;
  createdAt: string;
}

export default function AdminPaaSSshKeysPage() {
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [selectedKey, setSelectedKey] = useState<SshKey | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<{ success: boolean; keys: SshKey[] }>(
        "/api/admin/paas/ssh-keys"
      );
      setKeys(data.keys || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load SSH keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await apiClient.post<{ success: boolean; key: SshKey }>(
        "/api/admin/paas/ssh-keys/generate",
        { name: `paas-worker-${Date.now()}` }
      );
      
      toast.success("SSH key pair generated");
      setSelectedKey(data.key);
      setShowSetupDialog(true);
      void loadKeys();
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate SSH key");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (key: SshKey) => {
    if (key.usedByWorkers > 0) {
      toast.error(`Cannot delete key: used by ${key.usedByWorkers} worker(s)`);
      return;
    }

    const confirmed = window.confirm(
      `Delete SSH key "${key.name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await apiClient.delete(`/api/admin/paas/ssh-keys/${key.id}`);
      toast.success("SSH key deleted");
      void loadKeys();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete SSH key");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const setupCommand = selectedKey
    ? `mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo "${selectedKey.publicKey}" >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`
    : "";

  return (
    <div className="space-y-8">
      <PageHeader
        title="PaaS SSH Keys"
        description="Manage SSH keys used to connect and configure worker nodes."
        badge={{ text: "PaaS Admin", variant: "secondary" }}
      />

      <ContentCard
        title="SSH Keys"
        description="Generate and manage SSH key pairs for secure worker authentication."
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={loadKeys}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              <Plus className="h-4 w-4 mr-1" />
              {generating ? "Generating..." : "Generate Key"}
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="text-center py-8">
            <Key className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No SSH keys generated yet. Create one to start adding workers.
            </p>
            <Button onClick={handleGenerate} disabled={generating}>
              <Plus className="h-4 w-4 mr-2" />
              Generate First Key
            </Button>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Fingerprint</TableHead>
                  <TableHead>Used By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {key.fingerprint}
                    </TableCell>
                    <TableCell>
                      {key.usedByWorkers > 0 ? (
                        <Badge variant="default">
                          {key.usedByWorkers} worker{key.usedByWorkers !== 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Unused</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(key.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedKey(key);
                            setShowSetupDialog(true);
                          }}
                        >
                          View Setup
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(key)}
                          disabled={key.usedByWorkers > 0}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ContentCard>

      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Worker Setup Instructions</DialogTitle>
          </DialogHeader>
          {selectedKey && (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">1. Authorize the panel on the remote worker</p>
                <p className="text-sm text-muted-foreground">
                  <strong>SSH into your remote worker server</strong> and run this command as <code className="bg-muted px-1 py-0.5 rounded">root</code>.
                  This adds the panel's PUBLIC key to the worker's authorized_keys file, allowing the panel to SSH into it
                  using the corresponding PRIVATE key stored at <code className="bg-muted px-1 py-0.5 rounded">{selectedKey.keyPath}</code>.
                </p>
                <div className="space-y-2">
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap break-all">
{setupCommand}
                  </pre>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(setupCommand)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy command
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">2. Next - Add the worker to your cluster</p>
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3 space-y-2">
                  <ol className="text-xs text-blue-900 dark:text-blue-100 list-decimal list-inside space-y-1">
                    <li>Ensure the remote worker has Docker installed</li>
                    <li>Go to <strong>Workers</strong> page and click <strong>Add worker</strong></li>
                    <li>Select this SSH key from the dropdown (system will use the private key automatically)</li>
                    <li>The panel will run <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">uc machine add</code> to join your cluster</li>
                  </ol>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">3. Key details</p>
                <div className="rounded-md border bg-muted/40 text-xs divide-y divide-border">
                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                    <span className="text-muted-foreground">Path on panel host</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-background px-1.5 py-0.5 rounded border">{selectedKey.keyPath}</code>
                      <Button size="icon" variant="ghost" onClick={() => copyToClipboard(selectedKey.keyPath)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 gap-2">
                    <span className="text-muted-foreground">Fingerprint</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-background px-1.5 py-0.5 rounded border font-mono">
                        {selectedKey.fingerprint}
                      </code>
                      <Button size="icon" variant="ghost" onClick={() => copyToClipboard(selectedKey.fingerprint)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowSetupDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

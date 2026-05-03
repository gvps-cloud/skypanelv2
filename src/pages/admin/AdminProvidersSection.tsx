import React from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Edit,
  GripVertical,
  HelpCircle,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProviderValidationStatus = "valid" | "invalid" | "pending" | "unknown";

interface AdminProvider {
  id: string;
  name: string;
  type: "linode";
  active: boolean;
  configuration: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  validation_status?: ProviderValidationStatus;
  validation_message?: string | null;
  last_api_call?: string | null;
}

interface ProviderFormState {
  name: string;
  type: string;
  apiKey: string;
  active: boolean;
}

interface SortableProviderRowProps {
  provider: AdminProvider;
  validatingProviderId: string | null;
  onValidate: (id: string) => void;
  onEdit: (provider: AdminProvider) => void;
  onDelete: (id: string) => void;
}

const SortableProviderRow: React.FC<SortableProviderRowProps> = ({
  provider,
  validatingProviderId,
  onValidate,
  onEdit,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: provider.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? "relative z-50" : ""}>
      <TableCell className="w-8">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </TableCell>
      <TableCell className="font-medium text-foreground">{provider.name}</TableCell>
      <TableCell className="capitalize text-muted-foreground">{provider.type}</TableCell>
      <TableCell>
        <Badge variant={provider.active ? "default" : "secondary"}>
          {provider.active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        {provider.validation_status === "valid" && (
          <Badge
            variant="default"
            className="gap-1 border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
          >
            <CheckCircle className="h-3 w-3" /> Valid
          </Badge>
        )}
        {provider.validation_status === "invalid" && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" /> Invalid
          </Badge>
        )}
        {provider.validation_status === "pending" && (
          <Badge variant="secondary" className="gap-1">
            <Clock className="h-3 w-3" /> Pending
          </Badge>
        )}
        {(!provider.validation_status || provider.validation_status === "unknown") && (
          <Badge variant="secondary" className="gap-1">
            <HelpCircle className="h-3 w-3" /> Unknown
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {provider.last_api_call ? (
          <span title={new Date(provider.last_api_call).toLocaleString()}>
            {new Date(provider.last_api_call).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-muted-foreground/60">Never</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onValidate(provider.id)}
            disabled={validatingProviderId === provider.id}
            className="gap-1"
          >
            {validatingProviderId === provider.id ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Validating...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" /> Validate
              </>
            )}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(provider)} className="gap-1">
            <Edit className="h-4 w-4" /> Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(provider.id)} className="gap-1">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

interface AdminProvidersSectionProps {
  providers: AdminProvider[];
  validatingProviderId: string | null;
  showAddProvider: boolean;
  setShowAddProvider: React.Dispatch<React.SetStateAction<boolean>>;
  newProvider: ProviderFormState;
  setNewProvider: React.Dispatch<React.SetStateAction<ProviderFormState>>;
  setEditProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditProvider: React.Dispatch<React.SetStateAction<Partial<AdminProvider>>>;
  setDeleteProviderId: React.Dispatch<React.SetStateAction<string | null>>;
  onCreateProvider: () => void;
  onValidateProvider: (id: string) => void;
  onReorderProviders: (providers: AdminProvider[]) => void;
}

export const AdminProvidersSection: React.FC<AdminProvidersSectionProps> = ({
  providers,
  validatingProviderId,
  showAddProvider,
  setShowAddProvider,
  newProvider,
  setNewProvider,
  setEditProviderId,
  setEditProvider,
  setDeleteProviderId,
  onCreateProvider,
  onValidateProvider,
  onReorderProviders,
}) => {
  const providerSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleProviderDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = providers.findIndex((provider) => provider.id === active.id);
      const newIndex = providers.findIndex((provider) => provider.id === over.id);
      onReorderProviders(arrayMove(providers, oldIndex, newIndex));
    }
  };

  return (
    <>
      <div className="relative mb-6 overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/20 p-6 md:p-8">
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <Badge variant="secondary" className="mb-3">
              Infrastructure
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Service Providers
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Manage infrastructure provider credentials and access control
            </p>
          </div>
          <Button onClick={() => setShowAddProvider(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Add Provider
          </Button>
        </div>

        <div className="absolute right-0 top-0 h-full w-1/3 opacity-5">
          <Settings className="absolute right-10 top-10 h-32 w-32 rotate-12" />
        </div>
      </div>

      <Card className="border-primary/25">
        <CardHeader>
          <CardTitle>Provider List</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <DndContext
              sensors={providerSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleProviderDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Validation</TableHead>
                    <TableHead>Last API Call</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {providers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        No providers configured yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    <SortableContext
                      items={providers.map((provider) => provider.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {providers.map((provider) => (
                        <SortableProviderRow
                          key={provider.id}
                          provider={provider}
                          validatingProviderId={validatingProviderId}
                          onValidate={onValidateProvider}
                          onEdit={(currentProvider) => {
                            setEditProviderId(currentProvider.id);
                            setEditProvider(currentProvider);
                          }}
                          onDelete={(id) => setDeleteProviderId(id)}
                        />
                      ))}
                    </SortableContext>
                  )}
                </TableBody>
              </Table>
            </DndContext>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showAddProvider}
        onOpenChange={(open) => {
          setShowAddProvider(open);
          if (!open) {
            setNewProvider({
              name: "",
              type: "",
              apiKey: "",
              active: true,
            });
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Service Provider</DialogTitle>
            <DialogDescription>
              Save provider credentials securely. Only active providers can be used for new workloads.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="provider-name">Name</Label>
              <Input
                id="provider-name"
                placeholder="e.g. Linode Production"
                value={newProvider.name}
                onChange={(e) =>
                  setNewProvider((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                A friendly name to identify this provider configuration
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-type">Provider Type</Label>
              <Select
                value={newProvider.type}
                onValueChange={(value) =>
                  setNewProvider((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger id="provider-type">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linode">Linode</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="provider-key">API Token</Label>
              <Input
                id="provider-key"
                type="password"
                placeholder="Enter upstream API token"
                value={newProvider.apiKey}
                onChange={(e) =>
                  setNewProvider((prev) => ({
                    ...prev,
                    apiKey: e.target.value,
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Create an API token from your upstream provider dashboard with full access permissions
              </p>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Enable Provider</p>
                <p className="text-xs text-muted-foreground">
                  Inactive providers stay stored but hidden from provisioning.
                </p>
              </div>
              <Switch
                checked={newProvider.active}
                onCheckedChange={(checked) =>
                  setNewProvider((prev) => ({ ...prev, active: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddProvider(false);
                setNewProvider({
                  name: "",
                  type: "linode",
                  apiKey: "",
                  active: true,
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={onCreateProvider}
              disabled={!newProvider.name || !newProvider.type || !newProvider.apiKey}
            >
              Add Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

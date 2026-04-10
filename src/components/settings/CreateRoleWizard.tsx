import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  XCircle,
  Server,
  FileText,
  Key,
  Ticket,
  CreditCard,
  Users,
  Settings,
  Loader2,
  Check,
} from "lucide-react";

interface OrganizationRole {
  id: string;
  name: string;
  permissions: string[];
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

interface Permission {
  id: string;
  label: string;
  description: string;
  category: string;
}

interface CreateRoleWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (roleData: { name: string; permissions: string[] }) => void;
  editingRole?: OrganizationRole;
  loading?: boolean;
}

const PERMISSION_CATEGORIES = [
  {
    id: "vps",
    name: "VPS Management",
    icon: Server,
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconColor: "text-blue-400",
    borderColor: "border-blue-500/20",
  },
  {
    id: "ssh",
    name: "SSH Keys",
    icon: Key,
    gradient: "from-emerald-500/10 to-green-500/10",
    iconColor: "text-emerald-400",
    borderColor: "border-emerald-500/20",
  },
  {
    id: "support",
    name: "Support Tickets",
    icon: Ticket,
    gradient: "from-violet-500/10 to-purple-500/10",
    iconColor: "text-violet-400",
    borderColor: "border-violet-500/20",
  },
  {
    id: "billing",
    name: "Billing & Payments",
    icon: CreditCard,
    gradient: "from-amber-500/10 to-orange-500/10",
    iconColor: "text-amber-400",
    borderColor: "border-amber-500/20",
  },
  {
    id: "notes",
    name: "Notes",
    icon: FileText,
    gradient: "from-rose-500/10 to-pink-500/10",
    iconColor: "text-rose-400",
    borderColor: "border-rose-500/20",
  },
  {
    id: "members",
    name: "Team Management",
    icon: Users,
    gradient: "from-indigo-500/10 to-blue-500/10",
    iconColor: "text-indigo-400",
    borderColor: "border-indigo-500/20",
  },
  {
    id: "settings",
    name: "Settings",
    icon: Settings,
    gradient: "from-slate-500/10 to-zinc-500/10",
    iconColor: "text-slate-400",
    borderColor: "border-slate-500/20",
  },
];

const PERMISSIONS: Permission[] = [
  { id: "vps_view", label: "View Instances", description: "View all VPS instances", category: "vps" },
  { id: "vps_create", label: "Create Instances", description: "Provision new VPS instances", category: "vps" },
  { id: "vps_delete", label: "Delete Instances", description: "Remove VPS instances", category: "vps" },
  { id: "vps_manage", label: "Manage Instances", description: "Start, stop, restart, and configure", category: "vps" },
  { id: "notes_view", label: "View Notes", description: "Read organization notes", category: "notes" },
  { id: "notes_manage", label: "Manage Notes", description: "Create, edit, and delete organization notes", category: "notes" },
  { id: "ssh_keys_view", label: "View Keys", description: "View organization SSH keys", category: "ssh" },
  { id: "ssh_keys_manage", label: "Manage Keys", description: "Create and delete SSH keys", category: "ssh" },
  { id: "tickets_view", label: "View Tickets", description: "View support tickets", category: "support" },
  { id: "tickets_create", label: "Create Tickets", description: "Submit new support tickets", category: "support" },
  { id: "tickets_manage", label: "Manage Tickets", description: "Update and resolve tickets", category: "support" },
  { id: "billing_view", label: "View Billing", description: "View invoices and billing info", category: "billing" },
  { id: "billing_manage", label: "Manage Billing", description: "Manage payment methods", category: "billing" },
  { id: "members_manage", label: "Manage Members", description: "Add, remove, and manage team members", category: "members" },
  { id: "settings_manage", label: "Manage Settings", description: "Configure organization settings", category: "settings" },
];

export default function CreateRoleWizard({ isOpen, onClose, onSave, editingRole, loading }: CreateRoleWizardProps) {
  const [roleName, setRoleName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const roleNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingRole) {
      setRoleName(editingRole.name);
      setSelectedPermissions(Array.isArray(editingRole.permissions) ? editingRole.permissions : []);
    }
  }, [editingRole]);

  useEffect(() => {
    if (!isOpen) {
      setRoleName("");
      setSelectedPermissions([]);
      setErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        roleNameInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!roleName.trim()) {
      newErrors.name = "Role name is required";
    } else if (roleName.trim().length < 3) {
      newErrors.name = "Must be at least 3 characters";
    } else if (roleName.trim().length > 50) {
      newErrors.name = "Must be under 50 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave({
        name: roleName.trim(),
        permissions: selectedPermissions,
      });
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((p) => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const toggleCategory = (categoryId: string) => {
    const categoryPerms = PERMISSIONS.filter((p) => p.category === categoryId);
    const categoryPermIds = categoryPerms.map((p) => p.id);
    const allSelected = categoryPermIds.every((id) => selectedPermissions.includes(id));

    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((id) => !categoryPermIds.includes(id)));
    } else {
      setSelectedPermissions((prev) => [
        ...prev,
        ...categoryPermIds.filter((id) => !prev.includes(id)),
      ]);
    }
  };

  const getCategorySelectedCount = (categoryId: string) => {
    const categoryPerms = PERMISSIONS.filter((p) => p.category === categoryId);
    return categoryPerms.filter((p) => selectedPermissions.includes(p.id)).length;
  };

  const isEditing = !!editingRole;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {isEditing ? "Edit Role" : "Create Role"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isEditing
                    ? "Update role name and permissions"
                    : "Define a custom role for your team"}
                </p>
              </div>
            </div>
            {selectedPermissions.length > 0 && (
              <Badge
                variant="secondary"
                className="tabular-nums font-mono text-xs h-6 gap-1"
              >
                <Check className="h-3 w-3" />
                {selectedPermissions.length} / {PERMISSIONS.length}
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Role Name */}
          <div className="space-y-2">
            <Label htmlFor="createRoleName" className="text-sm font-medium">
              Role Name
            </Label>
            <Input
              ref={roleNameInputRef}
              id="createRoleName"
              placeholder="e.g., Billing Manager, Support Agent"
              value={roleName}
              onChange={(e) => {
                setRoleName(e.target.value);
                if (errors.name) setErrors({});
              }}
              className={errors.name ? "border-destructive focus-visible:ring-destructive/30" : ""}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            {errors.name && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3 flex-shrink-0" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Permissions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Permissions</Label>
              <button
                type="button"
                onClick={() => {
                  if (selectedPermissions.length === PERMISSIONS.length) {
                    setSelectedPermissions([]);
                  } else {
                    setSelectedPermissions(PERMISSIONS.map((p) => p.id));
                  }
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {selectedPermissions.length === PERMISSIONS.length
                  ? "Deselect all"
                  : "Select all"}
              </button>
            </div>

            <div className="space-y-3">
              {PERMISSION_CATEGORIES.map((category) => {
                const Icon = category.icon;
                const categoryPerms = PERMISSIONS.filter(
                  (p) => p.category === category.id
                );
                const selectedCount = getCategorySelectedCount(category.id);
                const allSelected = selectedCount === categoryPerms.length;

                return (
                  <div
                    key={category.id}
                    className={`rounded-lg border ${category.borderColor} bg-gradient-to-r ${category.gradient} overflow-hidden transition-all`}
                  >
                    {/* Category Header */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 ${category.iconColor}`} />
                        <span className="text-sm font-medium">{category.name}</span>
                        {selectedCount > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 tabular-nums border-border/50"
                          >
                            {selectedCount}/{categoryPerms.length}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {allSelected ? "Deselect all" : "Select all"}
                      </span>
                    </button>

                    {/* Permission Items */}
                    <div className="border-t border-border/30">
                      {categoryPerms.map((permission, idx) => {
                        const isActive = selectedPermissions.includes(permission.id);
                        return (
                          <div
                            key={permission.id}
                            className={`flex items-center justify-between px-4 py-2.5 ${
                              idx < categoryPerms.length - 1 ? "border-b border-border/20" : ""
                            } hover:bg-white/5 transition-colors`}
                          >
                            <div className="flex-1 min-w-0 pr-3">
                              <label
                                htmlFor={`perm-${permission.id}`}
                                className="text-sm cursor-pointer block"
                              >
                                {permission.label}
                              </label>
                              <p className="text-xs text-muted-foreground truncate">
                                {permission.description}
                              </p>
                            </div>
                            <Switch
                              id={`perm-${permission.id}`}
                              checked={isActive}
                              onCheckedChange={() => togglePermission(permission.id)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/30">
          <div className="flex items-center justify-between w-full gap-3">
            <p className="text-xs text-muted-foreground hidden sm:block">
              {selectedPermissions.length === 0
                ? "No permissions selected"
                : `${selectedPermissions.length} permission${selectedPermissions.length !== 1 ? "s" : ""} selected`}
            </p>
            <div className="flex items-center gap-2 ml-auto">
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : isEditing ? (
                  "Update Role"
                ) : (
                  "Create Role"
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

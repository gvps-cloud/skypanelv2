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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Shield, CheckCircle, XCircle, AlertCircle, Info, Server, Key, Ticket, CreditCard, Users, Settings } from "lucide-react";
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
  onSave: (roleData: { name: string; description?: string; permissions: string[] }) => void;
  editingRole?: OrganizationRole;
}

const PERMISSION_CATEGORIES = [
  {
    id: "vps",
    name: "VPS Management",
    description: "Manage virtual private server instances",
    icon: Server,
    color: "blue",
  },
  {
    id: "ssh",
    name: "SSH Keys",
    description: "Manage SSH access credentials",
    icon: Key,
    color: "green",
  },
  {
    id: "support",
    name: "Support Tickets",
    description: "Handle customer support requests",
    icon: Ticket,
    color: "purple",
  },
  {
    id: "billing",
    name: "Billing & Payments",
    description: "Manage invoices and payments",
    icon: CreditCard,
    color: "amber",
  },
  {
    id: "members",
    name: "Team Management",
    description: "Manage organization members",
    icon: Users,
    color: "indigo",
  },
  {
    id: "settings",
    name: "Settings",
    description: "Configure organization settings",
    icon: Settings,
    color: "gray",
  },
];

const PERMISSIONS: Permission[] = [
  { id: "vps_view", label: "View VPS Instances", description: "View all VPS instances in the organization", category: "vps" },
  { id: "vps_create", label: "Create VPS Instances", description: "Create new VPS instances", category: "vps" },
  { id: "vps_delete", label: "Delete VPS Instances", description: "Delete VPS instances", category: "vps" },
  { id: "vps_manage", label: "Manage VPS Instances", description: "Start, stop, restart, and configure VPS instances", category: "vps" },
  { id: "ssh_keys_view", label: "View SSH Keys", description: "View organization SSH keys", category: "ssh" },
  { id: "ssh_keys_manage", label: "Manage SSH Keys", description: "Create and delete organization SSH keys", category: "ssh" },
  { id: "tickets_view", label: "View Support Tickets", description: "View support tickets", category: "support" },
  { id: "tickets_create", label: "Create Support Tickets", description: "Create support tickets", category: "support" },
  { id: "tickets_manage", label: "Manage Support Tickets", description: "Update and resolve support tickets", category: "support" },
  { id: "billing_view", label: "View Billing", description: "View billing information and invoices", category: "billing" },
  { id: "billing_manage", label: "Manage Billing", description: "Manage payment methods and invoices", category: "billing" },
  { id: "members_manage", label: "Manage Team Members", description: "Add, remove, and manage team members", category: "members" },
  { id: "settings_manage", label: "Manage Settings", description: "Configure organization settings", category: "settings" },
];

export default function CreateRoleWizard({ isOpen, onClose, onSave, editingRole }: CreateRoleWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps] = useState(3);
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const roleNameInputRef = useRef<HTMLInputElement>(null);

  // Initialize with editing role data
  useEffect(() => {
    if (editingRole) {
      setRoleName(editingRole.name);
      setRoleDescription(editingRole.name.includes("Manager") ? "Manages specific aspects of the organization" : "");
      setSelectedPermissions(editingRole.permissions);
    }
  }, [editingRole]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setRoleName("");
      setRoleDescription("");
      setSelectedPermissions([]);
      setErrors({});
      setCurrentStep(1);
    }
  }, [isOpen]);

  // Focus on role name input when step 1 is active
  useEffect(() => {
    if (currentStep === 1 && isOpen) {
      setTimeout(() => {
        roleNameInputRef.current?.focus();
      }, 100);
    }
  }, [currentStep, isOpen]);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!roleName.trim()) {
        newErrors.name = "Role name is required";
      } else if (roleName.length < 3) {
        newErrors.name = "Role name must be at least 3 characters";
      } else if (roleName.length > 50) {
        newErrors.name = "Role name must be less than 50 characters";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    if (validateStep(currentStep)) {
      onSave({
        name: roleName.trim(),
        description: roleDescription.trim() || undefined,
        permissions: selectedPermissions,
      });
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(permissionId)
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const selectAllInCategory = (category: string) => {
    const categoryPermissions = PERMISSIONS.filter(p => p.category === category);
    const categoryPermissionIds = categoryPermissions.map(p => p.id);
    const allSelected = categoryPermissionIds.every(id => selectedPermissions.includes(id));

    if (allSelected) {
      setSelectedPermissions(prev => prev.filter(id => !categoryPermissionIds.includes(id)));
    } else {
      setSelectedPermissions(prev => [...prev, ...categoryPermissionIds.filter(id => !prev.includes(id))]);
    }
  };

  const getCategoryProgress = (category: string) => {
    const categoryPermissions = PERMISSIONS.filter(p => p.category === category);
    const selectedCount = categoryPermissions.filter(p => selectedPermissions.includes(p.id)).length;
    return (selectedCount / categoryPermissions.length) * 100;
  };

  const getStepTitle = (step: number) => {
    switch (step) {
      case 1: return "Role Information";
      case 2: return "Permissions";
      case 3: return "Review";
      default: return "";
    }
  };

  
  const getSelectedPermissionCount = () => {
    return selectedPermissions.length;
  };

  const getSelectedCategoryCount = () => {
    const categories = new Set(selectedPermissions.map(pId => {
      const perm = PERMISSIONS.find(p => p.id === pId);
      return perm?.category;
    }).filter(Boolean));
    return categories.size;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {editingRole ? "Edit Role" : "Create New Role"}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{getStepTitle(currentStep)}</span>
            </div>
            <Progress value={(currentStep / totalSteps) * 100} className="w-full" />
          </div>

          {/* Step Navigation */}
          <div className="flex justify-between">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(step => (
              <div key={step} className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === currentStep
                      ? "bg-primary text-primary-foreground"
                      : step < currentStep
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    step
                  )}
                </div>
                <span className="text-xs mt-1">{getStepTitle(step)}</span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Step Content */}
          <div className="space-y-6">
            {/* Step 1: Role Information */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-fadeIn">
                <div className="space-y-2">
                  <Label htmlFor="roleName">Role Name *</Label>
                  <Input
                    ref={roleNameInputRef}
                    id="roleName"
                    placeholder="e.g., Billing Manager, Support Agent"
                    value={roleName}
                    onChange={(e) => setRoleName(e.target.value)}
                    className={errors.name ? "border-destructive" : ""}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      {errors.name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Choose a clear, descriptive name for the role
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="roleDescription">Description (Optional)</Label>
                  <Textarea
                    id="roleDescription"
                    placeholder="Describe the purpose and responsibilities of this role..."
                    value={roleDescription}
                    onChange={(e) => setRoleDescription(e.target.value)}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Help team members understand what this role entails
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Permissions */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Select permissions for this role. Permissions are grouped by category.
                    </p>
                  </div>

                  {PERMISSION_CATEGORIES.map(category => {
                    const Icon = category.icon;
                    const categoryPermissions = PERMISSIONS.filter(p => p.category === category.id);
                    const allSelected = categoryPermissions.every(p => selectedPermissions.includes(p.id));

                    return (
                      <div key={category.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon className={`h-5 w-5 text-${category.color}-500`} />
                            <div>
                              <h3 className="font-medium">{category.name}</h3>
                              <p className="text-sm text-muted-foreground">{category.description}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => selectAllInCategory(category.id)}
                          >
                            {allSelected ? "Deselect All" : "Select All"}
                          </Button>
                        </div>

                        {/* Progress bar for category */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>Progress</span>
                            <span>{getCategoryProgress(category.id).toFixed(0)}%</span>
                          </div>
                          <Progress value={getCategoryProgress(category.id)} className="h-2" />
                        </div>

                        {/* Permissions */}
                        <div className="space-y-2">
                          {categoryPermissions.map(permission => (
                            <div key={permission.id} className="flex items-start space-x-3">
                              <Checkbox
                                id={permission.id}
                                checked={selectedPermissions.includes(permission.id)}
                                onCheckedChange={() => togglePermission(permission.id)}
                              />
                              <div className="flex-1">
                                <label
                                  htmlFor={permission.id}
                                  className="text-sm font-medium cursor-pointer"
                                >
                                  {permission.label}
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4" />
                    <span>{getSelectedPermissionCount()} permissions selected across {getSelectedCategoryCount()} categories</span>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-6">
                  {/* Role Information */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Role Information
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-muted-foreground">Name:</span>
                        <p className="font-medium">{roleName}</p>
                      </div>
                      {roleDescription && (
                        <div>
                          <span className="text-sm text-muted-foreground">Description:</span>
                          <p className="text-sm">{roleDescription}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Permissions Summary */}
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Permissions ({getSelectedPermissionCount()})
                    </h3>

                    {/* Category Summary */}
                    <div className="space-y-3 mb-4">
                      {PERMISSION_CATEGORIES.map(category => {
                        const categoryPermissions = PERMISSIONS.filter(p => p.category === category.id);
                        const selectedCategoryPermissions = categoryPermissions.filter(p => selectedPermissions.includes(p.id));

                        if (selectedCategoryPermissions.length > 0) {
                          return (
                            <div key={category.id} className="space-y-1">
                              <h4 className="font-medium text-sm">{category.name}</h4>
                              <div className="flex flex-wrap gap-1">
                                {selectedCategoryPermissions.map(permission => (
                                  <Badge key={permission.id} variant="secondary" className="text-xs">
                                    {permission.label}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>

                    {/* No Permissions Warning */}
                    {selectedPermissions.length === 0 && (
                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md">
                        <AlertCircle className="h-4 w-4" />
                        <p className="text-sm">No permissions selected. This role will not have access to any features.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex flex-col sm:flex-row w-full gap-2">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="flex-1"
              >
                Previous
              </Button>

              {currentStep < totalSteps ? (
                <Button onClick={handleNext} className="flex-1">
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} className="flex-1">
                  {editingRole ? "Update Role" : "Create Role"}
                </Button>
              )}

              <Button
                variant="ghost"
                onClick={onClose}
                className="sm:w-auto"
              >
                Cancel
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}


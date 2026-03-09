/**
 * Settings Page
 * User and organization settings management
 */

import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  User,
  Key,
  Bell,
  Shield,
  Save,
  Copy,
  Trash2,
  AlertTriangle,
  Mail,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import TeamSettings from "@/components/settings/TeamSettings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { TIMEZONE_OPTIONS } from "@/lib/timezones";

const Settings: React.FC = () => {
  const {
    user,
    updateProfile,
    changePassword,
    updatePreferences,
    verifyPassword,
    getApiKeys,
    createApiKey,
    revokeApiKey,
    setup2FA,
    verify2FA,
    disable2FA,
  } = useAuth();

  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "profile");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // API Keys State
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [showApiKey, _setShowApiKey] = useState<{
    [key: string]: boolean;
  }>({});
  const [newlyCreatedKeys, setNewlyCreatedKeys] = useState<{
    [key: string]: string;
  }>({});
  const [revokeModal, setRevokeModal] = useState<{
    isOpen: boolean;
    keyId: string;
    keyName: string;
  }>({
    isOpen: false,
    keyId: "",
    keyName: "",
  });

  // Profile State
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    timezone: "UTC",
  });

  // Security State
  const [securityData, setSecurityData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // 2FA State
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState(false);
  const [_twoFactorStep, setTwoFactorStep] = useState<
    "intro" | "setup" | "verify"
  >("intro");
  const [twoFactorSecret, setTwoFactorSecret] = useState("");
  const [twoFactorQr, setTwoFactorQr] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [disable2faModalOpen, setDisable2faModalOpen] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disabling2FA, setDisabling2FA] = useState(false);

  // Notifications State
  const [notificationData, setNotificationData] = useState({
    emailNotifications: true,
    billingAlerts: true,
    securityAlerts: true,
    maintenanceAlerts: true,
  });

  const normalizeNotificationPreferences = (raw: any) => {
    const nested =
      raw?.notifications && typeof raw.notifications === "object"
        ? raw.notifications
        : null;
    const source = nested || raw || {};

    return {
      emailNotifications:
        typeof source.emailNotifications === "boolean"
          ? source.emailNotifications
          : true,
      billingAlerts:
        typeof source.billingAlerts === "boolean" ? source.billingAlerts : true,
      securityAlerts:
        typeof source.securityAlerts === "boolean"
          ? source.securityAlerts
          : true,
      maintenanceAlerts:
        typeof source.maintenanceAlerts === "boolean"
          ? source.maintenanceAlerts
          : true,
    };
  };

  // Load Data
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        phone: user.phone || "",
        timezone: user.timezone || "UTC",
      });

      // Load preferences
      if (user.preferences?.notifications) {
        setNotificationData(
          normalizeNotificationPreferences(user.preferences.notifications),
        );
      }
    }
  }, [user]);

  // Load API Keys
  useEffect(() => {
    if (activeTab === "api") {
      const loadApiKeys = async () => {
        try {
          const keys = await getApiKeys();
          setApiKeys(keys);
        } catch (error) {
          console.error("Failed to load API keys:", error);
        }
      };
      loadApiKeys();
    }
  }, [activeTab, getApiKeys]);

  // Handlers
  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      await updateProfile({
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
        timezone: profileData.timezone,
      });
      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (securityData.newPassword !== securityData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (!securityData.currentPassword || !securityData.newPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    setLoading(true);
    try {
      await changePassword(
        securityData.currentPassword,
        securityData.newPassword,
      );
      setSecurityData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password changed successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle2FA = async (checked: boolean) => {
    if (checked) {
      // Start Setup Flow
      setTwoFactorStep("setup");
      setTwoFactorModalOpen(true);
      try {
        const { secret, qrCode } = await setup2FA();
        setTwoFactorSecret(secret);
        setTwoFactorQr(qrCode);
      } catch {
        toast.error("Failed to initialize 2FA setup");
        setTwoFactorModalOpen(false);
      }
    } else {
      // Require password confirmation before disabling
      setDisablePassword("");
      setDisable2faModalOpen(true);
    }
  };

  const handleConfirmDisable2FA = async () => {
    if (!disablePassword.trim()) {
      toast.error("Please enter your password");
      return;
    }

    setDisabling2FA(true);
    try {
      await verifyPassword(disablePassword.trim());
      await disable2FA();
      setDisable2faModalOpen(false);
      toast.success("Two-factor authentication disabled");
    } catch (error: any) {
      toast.error(error?.message || "Failed to disable 2FA");
    } finally {
      setDisabling2FA(false);
      setDisablePassword("");
    }
  };

  const handleVerify2FA = async () => {
    setLoading(true);
    try {
      await verify2FA(twoFactorCode);
      toast.success("Two-factor authentication enabled successfully!");
      setTwoFactorModalOpen(false);
      setTwoFactorCode("");
    } catch (error: any) {
      toast.error(error?.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotifications = async (newData?: any) => {
    const dataToSave = newData || notificationData;
    setLoading(true); // Maybe instant optimism?
    // Update local state if provided
    if (newData) setNotificationData(newData);

    try {
      // Send to backend
      await updatePreferences({
        notifications: dataToSave,
      });
      if (!newData) toast.success("Notification preferences updated");
    } catch (error: any) {
      toast.error(
        error?.message || "Failed to update notification preferences",
      );
      // Revert state if needed? For now simple error toast.
    } finally {
      setLoading(false);
    }
  };

  // Real-time update wrapper
  const toggleLabels: Record<string, string> = {
    emailNotifications: "Email notifications",
    billingAlerts: "Billing alerts",
    securityAlerts: "Security alerts",
    maintenanceAlerts: "Maintenance updates",
  };

  const updateNotificationSetting = async (key: string, value: boolean) => {
    const previous = { ...notificationData };
    const updated = { ...notificationData, [key]: value };
    setNotificationData(updated);

    try {
      await handleSaveNotifications(updated);
      const label = toggleLabels[key] || "Notification preference";
      toast.success(`${label} ${value ? "enabled" : "disabled"}`);
    } catch {
      setNotificationData(previous);
      toast.error("Failed to update notification preferences");
    }
  };

  // API Key Handlers
  const handleCreateApiKey = async () => {
    if (!newApiKeyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }
    setLoading(true);
    try {
      const newKey = await createApiKey(newApiKeyName);
      setApiKeys((prev) => [newKey, ...prev]);
      if (newKey.key) {
        setNewlyCreatedKeys((prev) => ({ ...prev, [newKey.id]: newKey.key }));
      }
      setNewApiKeyName("");
      toast.success("API key created successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to create API key");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    setLoading(true);
    try {
      await revokeApiKey(keyId);
      setApiKeys((prev) => prev.filter((key) => key.id !== keyId));
      setNewlyCreatedKeys((prev) => {
        const updated = { ...prev };
        delete updated[keyId];
        return updated;
      });
      setRevokeModal({ isOpen: false, keyId: "", keyName: "" });
      toast.success("API key revoked successfully");
    } catch (error: any) {
      toast.error(error?.message || "Failed to revoke API key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-2 text-muted-foreground">
          Manage your account settings and preferences.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <nav className="lg:w-64 flex-shrink-0 space-y-1">
          {[
            { id: "profile", name: "Profile", icon: User },
            { id: "security", name: "Security", icon: Shield },
            { id: "team", name: "Team Members", icon: Users },
            { id: "notifications", name: "Notifications", icon: Bell },
            { id: "api", name: "API Keys", icon: Key },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon
                  className={`mr-3 h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details and contact information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          firstName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          lastName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={profileData.email}
                      disabled
                      className="bg-muted text-muted-foreground cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">
                      Contact support to change email.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) =>
                        setProfileData({
                          ...profileData,
                          phone: e.target.value,
                        })
                      }
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={profileData.timezone}
                      onValueChange={(val) =>
                        setProfileData({ ...profileData, timezone: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t pt-6">
                <Button
                  onClick={handleSaveProfile}
                  disabled={loading}
                  className="min-w-[120px]"
                >
                  {loading ? (
                    <span className="animate-spin mr-2">⏳</span>
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Password</CardTitle>
                  <CardDescription>
                    Ensure your account is using a long, random password to stay
                    secure.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Current Password</Label>
                    <Input
                      type="password"
                      value={securityData.currentPassword}
                      onChange={(e) =>
                        setSecurityData({
                          ...securityData,
                          currentPassword: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>New Password</Label>
                      <Input
                        type="password"
                        value={securityData.newPassword}
                        onChange={(e) =>
                          setSecurityData({
                            ...securityData,
                            newPassword: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Confirm New Password</Label>
                      <Input
                        type="password"
                        value={securityData.confirmPassword}
                        onChange={(e) =>
                          setSecurityData({
                            ...securityData,
                            confirmPassword: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-6 flex justify-end">
                  <Button onClick={handleChangePassword} disabled={loading}>
                    Change Password
                  </Button>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Two-Factor Authentication</CardTitle>
                  <CardDescription>
                    Add an extra layer of security to your account by requiring
                    a code from your authenticator app.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Authenticator App</div>
                    <div className="text-sm text-muted-foreground">
                      Use an app like Google Authenticator or Authy
                    </div>
                  </div>
                  <Switch
                    checked={user?.twoFactorEnabled}
                    onCheckedChange={handleToggle2FA}
                  />
                </CardContent>
              </Card>

              <Dialog open={disable2faModalOpen} onOpenChange={setDisable2faModalOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Confirm disable 2FA</DialogTitle>
                    <DialogDescription>
                      Enter your password to confirm turning off two-factor authentication.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="disable-password">Password</Label>
                      <Input
                        id="disable-password"
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Enter your password"
                      />
                    </div>
                  </div>
                  <DialogFooter className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setDisable2faModalOpen(false)}
                      disabled={disabling2FA}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleConfirmDisable2FA} disabled={disabling2FA}>
                      {disabling2FA ? "Disabling..." : "Disable 2FA"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* TEAM TAB */}
          {activeTab === "team" && <TeamSettings />}

          {/* NOTIFICATIONS TAB */}
          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Choose how you receive updates and alerts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start space-x-4">
                  <Mail className="h-5 w-5 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-base">Email Notifications</Label>
                      <Switch
                        checked={notificationData.emailNotifications}
                        onCheckedChange={(checked) =>
                          updateNotificationSetting(
                            "emailNotifications",
                            checked,
                          )
                        }
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Receive important updates and alerts via email.
                    </p>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-medium mb-4">Alert Preferences</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Billing Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          Invoices, payment failures, and usage limits.
                        </p>
                      </div>
                      <Switch
                        checked={notificationData.billingAlerts}
                        onCheckedChange={(checked) =>
                          updateNotificationSetting("billingAlerts", checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Security Alerts</Label>
                        <p className="text-sm text-muted-foreground">
                          New logins, password changes, and API key activity.
                        </p>
                      </div>
                      <Switch
                        checked={notificationData.securityAlerts}
                        onCheckedChange={(checked) =>
                          updateNotificationSetting("securityAlerts", checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Maintenance Updates</Label>
                        <p className="text-sm text-muted-foreground">
                          Scheduled maintenance and system outages.
                        </p>
                      </div>
                      <Switch
                        checked={notificationData.maintenanceAlerts}
                        onCheckedChange={(checked) =>
                          updateNotificationSetting(
                            "maintenanceAlerts",
                            checked,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* API KEYS TAB */}
          {activeTab === "api" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Create API Key</CardTitle>
                  <CardDescription>
                    Generate a new API key for accessing the SkyPanel API
                    programmatically.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    <Input
                      placeholder="Key Name (e.g. My App)"
                      value={newApiKeyName}
                      onChange={(e) => setNewApiKeyName(e.target.value)}
                      className="max-w-md"
                    />
                    <Button
                      onClick={handleCreateApiKey}
                      disabled={loading || !newApiKeyName.trim()}
                    >
                      Create Key
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active API Keys</CardTitle>
                  <CardDescription>
                    Manage your existing API keys.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {apiKeys.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Key className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>No API keys found.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {apiKeys.map((key) => (
                        <div
                          key={key.id}
                          className="flex items-center justify-between p-4 border rounded-lg bg-card/50"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{key.name}</span>
                              <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            </div>
                            <div className="flex items-center text-sm text-muted-foreground font-mono">
                              {newlyCreatedKeys[key.id] ||
                                (showApiKey[key.id]
                                  ? key.key_preview
                                  : "••••••••••••••••••••" +
                                    key.key_preview?.slice(-4))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Created{" "}
                              {new Date(key.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {newlyCreatedKeys[key.id] && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    newlyCreatedKeys[key.id],
                                  );
                                  toast.success("Copied to clipboard");
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                setRevokeModal({
                                  isOpen: true,
                                  keyId: key.id,
                                  keyName: key.name,
                                })
                              }
                              className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* 2FA SETUP MODAL */}
      <Dialog open={twoFactorModalOpen} onOpenChange={setTwoFactorModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Use your authenticator app to scan the QR code below.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center p-4 space-y-4">
            {twoFactorQr && (
              <div className="p-4 bg-white rounded-lg">
                <img
                  src={twoFactorQr}
                  alt="2FA QR Code"
                  className="w-48 h-48"
                />
              </div>
            )}

            <div className="text-center space-y-2">
              <Label>Or enter code manually:</Label>
              <code className="block p-2 bg-muted rounded text-sm font-mono break-all">
                {twoFactorSecret}
              </code>
            </div>

            <div className="w-full space-y-2 pt-4">
              <Label>Verify Code</Label>
              <Input
                placeholder="Enter 6-digit code"
                value={twoFactorCode}
                onChange={(e) =>
                  setTwoFactorCode(
                    e.target.value.replace(/\D/g, "").slice(0, 6),
                  )
                }
                className="text-center tracking-widest text-lg"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTwoFactorModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVerify2FA}
              disabled={loading || twoFactorCode.length !== 6}
            >
              {loading ? "Verifying..." : "Verify & Enable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REVOKE KEY MODAL */}
      <Dialog
        open={revokeModal.isOpen}
        onOpenChange={(open) =>
          !open && setRevokeModal({ ...revokeModal, isOpen: false })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Revoke API Key
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke{" "}
              <strong>{revokeModal.keyName}</strong>? This action cannot be
              undone and any applications using this key will immediately stop
              working.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRevokeModal({ ...revokeModal, isOpen: false })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleRevokeApiKey(revokeModal.keyId)}
            >
              Revoke Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;

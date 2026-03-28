import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Eye, EyeOff, Key, Shield, AlertTriangle } from 'lucide-react';
import { SSHKeyAccordionSelect } from './SSHKeyAccordionSelect';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CreateVPSForm } from '@/types/vps';
import { getUserFriendlyErrorMessage } from '@/lib/providerErrors';
import { BackupConfiguration } from './BackupConfiguration';
import { CostSummary } from './CostSummary';

interface SSHKey {
  id: number;
  label: string;
  ssh_key: string;
  created: string;
}

interface LinodeConfigurationProps {
  formData: Partial<CreateVPSForm>;
  onChange: (updates: Partial<CreateVPSForm>) => void;
  token: string;
}

export default function LinodeConfiguration({
  formData,
  onChange,
  token,
}: LinodeConfigurationProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [sshKeys, setSshKeys] = useState<SSHKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [keysError, setKeysError] = useState<any>(null);
  const [passwordError, setPasswordError] = useState<string>('');

  // Fetch SSH keys on mount
  useEffect(() => {
    const fetchSSHKeys = async () => {
      try {
        setLoadingKeys(true);
        setKeysError(null);
        const providerId = formData.provider_id || 'active';
        const response = await fetch(`/api/vps/providers/${providerId}/ssh-keys`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw data.error || { message: 'Failed to fetch SSH keys' };
        }

        setSshKeys(data.ssh_keys || []);
      } catch (err: any) {
        console.error('Failed to fetch SSH keys:', err);
        setKeysError(err);
        // Don't show toast for SSH keys as they're optional
      } finally {
        setLoadingKeys(false);
      }
    };

    fetchSSHKeys();
  }, [token, formData.provider_id]);

  // Validate password strength
  const validatePassword = (password: string): string => {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(password)) {
      return 'Password must contain at least one number';
    }
    return '';
  };

  const handlePasswordChange = (password: string) => {
    onChange({ rootPassword: password });
    const error = validatePassword(password);
    setPasswordError(error);
  };

  const handleSSHKeyToggle = (keyId: number) => {
    const currentKeys = formData.sshKeys || [];
    const keyIdStr = String(keyId);
    
    if (currentKeys.includes(keyIdStr)) {
      onChange({ sshKeys: currentKeys.filter(k => k !== keyIdStr) });
    } else {
      onChange({ sshKeys: [...currentKeys, keyIdStr] });
    }
  };

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    if (!password) return { strength: 0, label: 'None', color: 'bg-gray-300' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength: 33, label: 'Weak', color: 'bg-red-500' };
    if (strength <= 4) return { strength: 66, label: 'Medium', color: 'bg-yellow-500' };
    return { strength: 100, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(formData.rootPassword || '');

  return (
    <div className="space-y-6">
      {/* Root Password - Required */}
      <div className="space-y-2">
        <Label htmlFor="root-password" className="text-sm font-medium text-foreground">
          Root Password *
        </Label>
        <div className="relative">
          <Input
            id="root-password"
            type={showPassword ? 'text' : 'password'}
            value={formData.rootPassword || ''}
            onChange={(e) => handlePasswordChange(e.target.value)}
            placeholder="Enter a strong password"
            className={cn(
              "pr-10",
              passwordError && formData.rootPassword ? 'border-destructive' : ''
            )}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        
        {/* Password strength indicator */}
        {formData.rootPassword && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Password strength:</span>
              <span className={cn(
                "font-medium",
                passwordStrength.label === 'Weak' && 'text-red-500',
                passwordStrength.label === 'Medium' && 'text-yellow-500',
                passwordStrength.label === 'Strong' && 'text-green-500'
              )}>
                {passwordStrength.label}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all duration-300", passwordStrength.color)}
                style={{ width: `${passwordStrength.strength}%` }}
              />
            </div>
          </div>
        )}
        
        {passwordError && formData.rootPassword && (
          <p className="text-xs text-destructive">{passwordError}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Must be at least 8 characters with uppercase, lowercase, and numbers
        </p>
      </div>

      {/* SSH Keys - Optional */}
      <SSHKeyAccordionSelect
        sshKeys={sshKeys}
        selectedKeyIds={formData.sshKeys || []}
        onKeyToggle={handleSSHKeyToggle}
        loading={loadingKeys}
        error={keysError ? getUserFriendlyErrorMessage(keysError, 'linode') : null}
      />

      {/* Linode-specific options */}
      <div className="space-y-4 pt-2 border-t">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Additional Options
        </h4>

        {/* Backups with frequency selection */}
        {formData.type && (
          <BackupConfiguration
            planId={formData.type}
            backupsEnabled={formData.backups || false}
            backupFrequency={formData.backup_frequency || "weekly"}
            onBackupsChange={(enabled) => onChange({ backups: enabled })}
            onFrequencyChange={(frequency) => onChange({ backup_frequency: frequency })}
            token={token}
          />
        )}

        {/* Private IP */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={formData.privateIP || false}
            onChange={(e) => onChange({ privateIP: e.target.checked })}
            className="mt-0.5 h-4 w-4 text-primary focus:ring-primary border rounded"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
              Private IP
            </p>
            <p className="text-xs text-muted-foreground">
              Assign a private IP address for internal networking (free)
            </p>
          </div>
        </label>
      </div>

      {/* Cost Summary */}
      {formData.type && (
        <CostSummary
          planId={formData.type}
          backupsEnabled={formData.backups || false}
          backupFrequency={formData.backup_frequency || "none"}
          token={token}
        />
      )}

      {/* Configuration summary */}
      <div className="rounded-lg bg-muted p-4 space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Configuration Summary</h4>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Root Password:</span>
            <span className="font-medium text-foreground">
              {formData.rootPassword ? '••••••••' : 'Not set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>SSH Keys:</span>
            <span className="font-medium text-foreground">
              {(formData.sshKeys || []).length} selected
            </span>
          </div>
          <div className="flex justify-between">
            <span>Backups:</span>
            <span className="font-medium text-foreground">
              {formData.backups 
                ? `Enabled (${formData.backup_frequency === 'daily' ? 'Daily' : 'Weekly'})`
                : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Private IP:</span>
            <span className="font-medium text-foreground">
              {formData.privateIP ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { validateSSHPublicKey } from '@/lib/validation';

interface SSHKeyFormProps {
  onSubmit: (data: { name: string; publicKey: string }) => Promise<void>;
  isLoading: boolean;
  onCancel?: () => void;
}

export const SSHKeyForm: React.FC<SSHKeyFormProps> = ({
  onSubmit,
  isLoading,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [errors, setErrors] = useState<{ name?: string; publicKey?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { name?: string; publicKey?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.length > 100) {
      newErrors.name = 'Name must be less than 100 characters';
    } else if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      newErrors.name = 'Name can only contain letters, numbers, spaces, hyphens, and underscores';
    }

    // Use centralized SSH key validation
    const keyValidation = validateSSHPublicKey(publicKey);
    if (!keyValidation.valid) {
      newErrors.publicKey = keyValidation.error;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    await onSubmit({
      name: name.trim(),
      publicKey: publicKey.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Key Name</Label>
        <Input
          id="name"
          placeholder="My SSH Key"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
        <p className="text-sm text-muted-foreground">
          A friendly name to identify this SSH key
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="publicKey">Public Key</Label>
        <Textarea
          id="publicKey"
          placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC... user@host"
          className="font-mono text-sm min-h-[120px]"
          value={publicKey}
          onChange={(e) => setPublicKey(e.target.value)}
          disabled={isLoading}
        />
        {errors.publicKey && (
          <p className="text-sm text-destructive">{errors.publicKey}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Paste your SSH public key. Supported formats: ssh-rsa, ssh-ed25519, ecdsa-sha2-*
        </p>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Key...
            </>
          ) : (
            'Add SSH Key'
          )}
        </Button>
      </div>
    </form>
  );
};

import React from 'react';
import { Loader2, User, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ImpersonationLoadingOverlayProps {
  targetUser: {
    name: string;
    email: string;
    role: string;
  };
  progress?: number;
  message?: string;
}

export const ImpersonationLoadingOverlay: React.FC<ImpersonationLoadingOverlayProps> = ({
  targetUser,
  progress = 0,
  message = 'Initializing impersonation...',
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 animate-in zoom-in-95 duration-300">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            {/* Icon and Title */}
            <div className="flex items-center justify-center space-x-2">
              <div className="relative">
                <User className="h-8 w-8 text-muted-foreground" />
                <Shield className="h-4 w-4 text-amber-500 absolute -top-1 -right-1" />
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Starting Impersonation</h3>
              <p className="text-sm text-muted-foreground">
                Preparing to act as <span className="font-medium">{targetUser.name}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {targetUser.email}
                {targetUser.role === 'admin' && (
                  <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded text-xs">
                    Admin
                  </span>
                )}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground">{message}</p>
            </div>

            {/* Security Notice */}
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              <p className="font-medium mb-1">Security Notice:</p>
              <p>All actions performed during impersonation will be logged for audit purposes.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
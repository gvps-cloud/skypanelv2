import React from 'react';
import { Eye, Edit, UserCheck, MoreHorizontal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;

}

interface UserActionMenuProps {
  user: AdminUserRecord;
  onView: (user: AdminUserRecord) => void;
  onEdit: (user: AdminUserRecord) => void;
  onImpersonate: (user: AdminUserRecord) => void;
  isLoadingDetails?: boolean;
  isImpersonating?: boolean;
  disabled?: boolean;
}

export const UserActionMenu: React.FC<UserActionMenuProps> = ({
  user,
  onView,
  onEdit,
  onImpersonate,
  isLoadingDetails = false,
  isImpersonating = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0 transition-all duration-200 hover:scale-105",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            disabled && "opacity-50 cursor-not-allowed hover:scale-100",
            isOpen && "bg-accent"
          )}
          aria-label={`Actions for ${user.name} (${user.email})`}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          disabled={disabled}
        >
          <MoreHorizontal className={cn(
            "h-4 w-4 transition-transform duration-200",
            isOpen && "rotate-90"
          )} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "w-48 animate-in slide-in-from-top-2 duration-200",
          "border border-border/50 shadow-lg"
        )}
        sideOffset={4}
      >
        <DropdownMenuItem
          onClick={() => handleAction(() => onView(user))}
          onKeyDown={(e) => handleKeyDown(e, () => onView(user))}
          className={cn(
            "cursor-pointer transition-all duration-150",
            "focus:bg-accent focus:text-accent-foreground",
            "hover:bg-accent/50",
            isLoadingDetails && "opacity-75"
          )}
          disabled={isLoadingDetails || disabled}
          aria-describedby={isLoadingDetails ? "loading-details" : undefined}
        >
          {isLoadingDetails ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Eye className="mr-2 h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
          )}
          <span>{isLoadingDetails ? 'Loading...' : 'View Details'}</span>
          {isLoadingDetails && (
            <span id="loading-details" className="sr-only">
              Loading user details, please wait
            </span>
          )}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleAction(() => onEdit(user))}
          onKeyDown={(e) => handleKeyDown(e, () => onEdit(user))}
          className={cn(
            "cursor-pointer transition-all duration-150",
            "focus:bg-accent focus:text-accent-foreground",
            "hover:bg-accent/50 group"
          )}
          disabled={disabled}
        >
          <Edit className="mr-2 h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
          <span>Edit User</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1" />

        <DropdownMenuItem
          onClick={() => handleAction(() => onImpersonate(user))}
          onKeyDown={(e) => handleKeyDown(e, () => onImpersonate(user))}
          className={cn(
            "cursor-pointer transition-all duration-150 group",
            "focus:bg-accent focus:text-accent-foreground",
            "hover:bg-accent/50",
            user.role === 'admin' && "text-amber-600 dark:text-amber-400",
            isImpersonating && "opacity-75"
          )}
          disabled={isImpersonating || disabled}
          aria-describedby={isImpersonating ? "impersonating-user" : undefined}
        >
          {isImpersonating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <UserCheck className="mr-2 h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
          )}
          <span className="flex-1">
            {isImpersonating ? 'Starting...' : 'Act as User'}
          </span>
          {user.role === 'admin' && (
            <span className="ml-auto text-xs opacity-75 transition-opacity duration-150 group-hover:opacity-100">
              Admin
            </span>
          )}
          {isImpersonating && (
            <span id="impersonating-user" className="sr-only">
              Starting impersonation, please wait
            </span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
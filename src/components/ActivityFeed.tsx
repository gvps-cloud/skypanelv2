import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Bell,
  Mail,
  UserPlus,
  UserMinus,
  Shield,
  Check,
  X,
  MoreHorizontal,
  Inbox,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api';

export interface ActivityData {
  id: string;
  user_id: string;
  organization_id: string | null;
  type: string;
  title: string;
  description: string | null;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
  organization_name?: string;
}

type ActivityType = 
  | 'invitation_received'
  | 'invitation_accepted'
  | 'invitation_declined'
  | 'member_added'
  | 'member_removed'
  | 'role_updated';

interface ActivityItemProps {
  activity: ActivityData;
  onMarkAsRead: (id: string) => void;
  onAccept?: (invitationId: string) => void;
  onDecline?: (invitationId: string) => void;
  isLoadingAccept?: boolean;
  isLoadingDecline?: boolean;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'invitation_received':
    case 'invitation_accepted':
    case 'invitation_declined':
      return Mail;
    case 'member_added':
      return UserPlus;
    case 'member_removed':
      return UserMinus;
    case 'role_updated':
      return Shield;
    default:
      return Bell;
  }
};

const getActivityIconColor = (type: string) => {
  switch (type) {
    case 'invitation_received':
      return 'text-blue-500';
    case 'invitation_accepted':
      return 'text-green-500';
    case 'invitation_declined':
      return 'text-red-500';
    case 'member_added':
      return 'text-emerald-500';
    case 'member_removed':
      return 'text-orange-500';
    case 'role_updated':
      return 'text-purple-500';
    default:
      return 'text-gray-500';
  }
};

const ActivityItem: React.FC<ActivityItemProps> = ({
  activity,
  onMarkAsRead,
  onAccept,
  onDecline,
  isLoadingAccept,
  isLoadingDecline,
}) => {
  const Icon = getActivityIcon(activity.type);
  const iconColor = getActivityIconColor(activity.type);
  const isUnread = !activity.is_read;

  const handleClick = () => {
    if (isUnread) {
      onMarkAsRead(activity.id);
    }
  };

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAccept && activity.data?.invitation_id) {
      onAccept(activity.data.invitation_id);
    }
  };

  const handleDecline = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDecline && activity.data?.invitation_id) {
      onDecline(activity.data.invitation_id);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        flex gap-3 p-3 cursor-pointer transition-colors
        ${isUnread ? 'bg-accent/50' : 'hover:bg-accent/30'}
      `}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      aria-label={activity.title}
    >
      <div className={`mt-0.5 ${iconColor}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${isUnread ? 'font-semibold' : 'font-normal'}`}>
            {activity.title}
          </p>
          {isUnread && (
            <div className="flex-shrink-0 mt-1">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
          )}
        </div>
        {activity.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {activity.description}
          </p>
        )}
        {activity.data?.organization_name && (
          <div className="mt-1">
            <Badge variant="outline" className="text-xs">
              {activity.data.organization_name}
            </Badge>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(activity.created_at)}
        </p>
        {activity.type === 'invitation_received' && (
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleAccept}
              disabled={isLoadingAccept || isLoadingDecline}
              className="h-7 px-2 text-xs"
            >
              {isLoadingAccept ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Accept
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDecline}
              disabled={isLoadingAccept || isLoadingDecline}
              className="h-7 px-2 text-xs"
            >
              {isLoadingDecline ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Decline
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

const ActivityFeed: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ['activities'],
    queryFn: async () => {
      const response = await apiClient.get('/activities');
      return response as { activities: ActivityData[] };
    },
    enabled: !!user,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const { data: unreadCountData } = useQuery({
    queryKey: ['activities', 'unread-count'],
    queryFn: async () => {
      const response = await apiClient.get('/activities/unread-count');
      return response as { count: number };
    },
    enabled: !!user,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await apiClient.put(`/activities/${activityId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['activities', 'unread-count'] });
    },
    onError: (error: any) => {
      console.error('Failed to mark activity as read:', error);
      toast.error('Failed to mark as read');
    },
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiClient.post(`/organizations/invitations/${invitationId}/accept`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['activities', 'unread-count'] });
      toast.success('Invitation accepted');
    },
    onError: (error: any) => {
      console.error('Failed to accept invitation:', error);
      toast.error(error.message || 'Failed to accept invitation');
    },
  });

  const declineInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const response = await apiClient.post(`/organizations/invitations/${invitationId}/decline`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['activities', 'unread-count'] });
      toast.success('Invitation declined');
    },
    onError: (error: any) => {
      console.error('Failed to decline invitation:', error);
      toast.error(error.message || 'Failed to decline invitation');
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put('/activities/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      queryClient.invalidateQueries({ queryKey: ['activities', 'unread-count'] });
      toast.success('All activities marked as read');
    },
    onError: (error: any) => {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    },
  });

  const handleMarkAsRead = (activityId: string) => {
    markAsReadMutation.mutate(activityId);
  };

  const handleAcceptInvitation = (invitationId: string) => {
    setAcceptingId(invitationId);
    acceptInvitationMutation.mutate(invitationId, {
      onSettled: () => {
        setAcceptingId(null);
      },
    });
  };

  const handleDeclineInvitation = (invitationId: string) => {
    setDecliningId(invitationId);
    declineInvitationMutation.mutate(invitationId, {
      onSettled: () => {
        setDecliningId(null);
      },
    });
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const activities = activitiesData?.activities || [];
  const unreadCount = unreadCountData?.count || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Open activity feed"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0"
        align="end"
        sideOffset={4}
      >
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <h3 className="font-semibold text-sm">Activity Feed</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs h-7"
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                'Mark all read'
              )}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {activitiesLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No activities yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                You'll see notifications here when you're invited to organizations or when team events occur
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {activities.map((activity) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  onMarkAsRead={handleMarkAsRead}
                  onAccept={activity.type === 'invitation_received' ? handleAcceptInvitation : undefined}
                  onDecline={activity.type === 'invitation_received' ? handleDeclineInvitation : undefined}
                  isLoadingAccept={acceptingId === activity.data?.invitation_id}
                  isLoadingDecline={decliningId === activity.data?.invitation_id}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default ActivityFeed;

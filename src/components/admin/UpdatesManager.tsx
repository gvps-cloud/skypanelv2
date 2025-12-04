import React, { useState, useEffect } from 'react';
import { GitCommit, Calendar, ExternalLink, RefreshCw, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { buildApiUrl } from '@/lib/api';
import type { GitHubCommit } from '@/types/faq';

interface UpdatesManagerProps {
  token: string;
}

export const UpdatesManager: React.FC<UpdatesManagerProps> = ({ token }) => {
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCommits = async (forceRefresh: boolean = false) => {
    if (!token) return;
    
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const url = buildApiUrl(`/api/admin/github/commits?limit=10${forceRefresh ? '&refresh=true' : ''}`);
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load commits');
      setCommits(data.commits || []);
      if (forceRefresh) {
        toast.success('Commits refreshed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load commits');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCommits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
      }
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getCommitTypeColor = (title: string): string => {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.startsWith('feat')) return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (lowerTitle.startsWith('fix')) return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (lowerTitle.startsWith('docs')) return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (lowerTitle.startsWith('style')) return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    if (lowerTitle.startsWith('refactor')) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    if (lowerTitle.startsWith('test')) return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
    if (lowerTitle.startsWith('chore')) return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    return 'bg-muted text-muted-foreground border-border';
  };

  const getCommitType = (title: string): string => {
    const match = title.match(/^(\w+)(?:\(.*?\))?:/);
    if (match) return match[1];
    return 'commit';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <GitCommit className="h-5 w-5" />
            Latest Updates
          </CardTitle>
          <CardDescription>Recent changes from the repository</CardDescription>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => fetchCommits(true)}
                disabled={refreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Force refresh from GitHub</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="py-10 text-center text-muted-foreground">Loading commits...</div>
        ) : commits.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            No commits found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Type</TableHead>
                  <TableHead className="min-w-[300px]">Commit</TableHead>
                  <TableHead className="w-40">Author</TableHead>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commits.map((commit) => (
                  <TableRow key={commit.sha}>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`text-xs font-medium ${getCommitTypeColor(commit.title)}`}
                      >
                        {getCommitType(commit.title)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {commit.title}
                        </div>
                        {commit.description && (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {commit.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground font-mono">
                          {commit.shortSha}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {commit.author.avatarUrl ? (
                          <img 
                            src={commit.author.avatarUrl} 
                            alt={commit.author.name}
                            className="h-6 w-6 rounded-full"
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {commit.author.username}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDate(commit.date)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="gap-1"
                            >
                              <a 
                                href={commit.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                                View
                              </a>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>View on GitHub</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

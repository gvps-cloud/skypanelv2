/**
 * GitHub API Service for SkyPanelV2
 * Fetches commit history from the skypanelv2 repository
 */

export interface GitHubCommit {
  sha: string;
  shortSha: string;
  title: string;
  description: string;
  date: string;
  author: {
    name: string;
    username: string;
    avatarUrl: string;
  };
  url: string;
}

interface GitHubApiCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author: {
    login: string;
    avatar_url: string;
  } | null;
}

const GITHUB_REPO_OWNER = 'skyvps360';
const GITHUB_REPO_NAME = 'skypanelv2';
const GITHUB_API_BASE = 'https://api.github.com';

// Simple in-memory cache
let commitsCache: { data: GitHubCommit[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Parse commit message into title and description
 * Title is the first line, description is the rest
 */
function parseCommitMessage(message: string): { title: string; description: string } {
  const lines = message.split('\n');
  const title = lines[0]?.trim() || 'No commit message';
  const description = lines.slice(1).join('\n').trim();
  return { title, description };
}

/**
 * Fetch commits from the GitHub repository
 * @param limit Maximum number of commits to fetch (default: 10)
 * @param forceRefresh Force refresh the cache
 */
export async function fetchGitHubCommits(
  limit: number = 10,
  forceRefresh: boolean = false
): Promise<GitHubCommit[]> {
  // Check cache
  if (!forceRefresh && commitsCache && Date.now() - commitsCache.timestamp < CACHE_TTL_MS) {
    return commitsCache.data.slice(0, limit);
  }

  const url = `${GITHUB_API_BASE}/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/commits?per_page=${Math.min(limit, 100)}`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'SkyPanelV2',
  };

  // Use GitHub token if available for higher rate limits
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      // Handle Rate Limit specifically (403 Forbidden or 429 Too Many Requests)
      if (response.status === 403 || response.status === 429) {
        console.warn(`GitHub API rate limit exceeded (${response.status}).`);
        
        // Return stale cache if available
        if (commitsCache) {
          console.warn('Returning stale cache data due to rate limit.');
          return commitsCache.data.slice(0, limit);
        }
        
        console.warn('No cache available. Returning empty list to prevent crash. Please add GITHUB_TOKEN to .env to increase rate limits.');
        return [];
      }

      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: GitHubApiCommit[] = await response.json();

    const commits: GitHubCommit[] = data.map((commit) => {
      const { title, description } = parseCommitMessage(commit.commit.message);
      
      return {
        sha: commit.sha,
        shortSha: commit.sha.substring(0, 7),
        title,
        description,
        date: commit.commit.author.date,
        author: {
          name: commit.commit.author.name,
          username: commit.author?.login || commit.commit.author.name,
          avatarUrl: commit.author?.avatar_url || '',
        },
        url: commit.html_url,
      };
    });

    // Update cache
    commitsCache = {
      data: commits,
      timestamp: Date.now(),
    };

    return commits.slice(0, limit);
  } catch (error) {
    console.error('Error fetching GitHub commits:', error);
    
    // Fallback to cache if available on error
    if (commitsCache) {
      return commitsCache.data.slice(0, limit);
    }
    
    // Return empty array to prevent UI crash
    return [];
  }
}

/**
 * Clear the commits cache
 */
export function clearCommitsCache(): void {
  commitsCache = null;
}

// FAQ Category types
export interface FAQCategory {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// FAQ Item types
export interface FAQItem {
  id: string;
  category_id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// FAQ Update types
export interface FAQUpdate {
  id: string;
  title: string;
  description: string;
  published_date: string;
  display_order: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  // GitHub commit fields (optional)
  url?: string;
  author?: string;
}

// API response types
export interface FAQCategoryWithItems extends FAQCategory {
  items: FAQItem[];
}

export interface FAQCategoriesResponse {
  categories: FAQCategoryWithItems[];
}

export interface FAQUpdatesResponse {
  updates: FAQUpdate[];
}

export interface FAQCategoryResponse {
  category: FAQCategory;
}

export interface FAQItemResponse {
  item: FAQItem;
}

export interface FAQUpdateResponse {
  update: FAQUpdate;
}

// Form data types
export interface CategoryFormData {
  name: string;
  description?: string;
  is_active?: boolean;
}

export interface ItemFormData {
  category_id: string;
  question: string;
  answer: string;
  is_active?: boolean;
}

export interface UpdateFormData {
  title: string;
  description: string;
  published_date?: string;
  is_active?: boolean;
}

// Reorder types
export interface ReorderItem {
  id: string;
  display_order: number;
}

export interface ReorderCategoriesRequest {
  categories: ReorderItem[];
}

export interface ReorderItemsRequest {
  items: ReorderItem[];
}

export interface ReorderUpdatesRequest {
  updates: ReorderItem[];
}

// GitHub commit types
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

export interface GitHubCommitsResponse {
  success: boolean;
  commits: GitHubCommit[];
  count: number;
}

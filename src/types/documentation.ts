// Documentation System Types

export interface DocumentationCategory {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentationCategoryWithArticles extends DocumentationCategory {
  articles: DocumentationArticle[];
  article_count?: number;
}

export interface DocumentationArticle {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentationArticleWithFiles extends DocumentationArticle {
  files: DocumentationFile[];
  category?: DocumentationCategory;
}

export interface DocumentationFile {
  id: string;
  article_id?: string;
  filename: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

// API Response Types
export interface DocumentationCategoriesResponse {
  categories: DocumentationCategoryWithArticles[];
}

export interface DocumentationCategoryResponse {
  category: DocumentationCategoryWithArticles;
}

export interface DocumentationArticleResponse {
  article: DocumentationArticleWithFiles;
}

export interface DocumentationFilesResponse {
  files: DocumentationFile[];
}

// Form Types for Admin
export interface DocumentationCategoryFormData {
  name: string;
  description?: string;
  slug: string;
  icon?: string;
  is_active: boolean;
}

export interface DocumentationArticleFormData {
  category_id: string;
  title: string;
  slug: string;
  content: string;
  summary?: string;
  is_active: boolean;
}

// Reorder types
export interface CategoryReorderItem {
  id: string;
  display_order: number;
}

export interface ArticleReorderItem {
  id: string;
  display_order: number;
}

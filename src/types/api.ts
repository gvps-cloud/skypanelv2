export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
}

export interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiErrorResponse {
  error: string;
  details?: string;
  code?: string;
}

export interface ApiSuccessResponse<T> {
  data: T;
  message?: string;
}

export interface ListParams {
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

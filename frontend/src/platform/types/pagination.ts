export interface Page<T> {
  items: T[];
  total_items: number;
  page: number;
  size: number;
  total_pages: number;
} 
/**
 * Normalized card for UI / WS / cache
 */
export interface NewsCard {
  id: string;
  title: string;
  description: string | null;
  image: string | null;
  url: string;
  source: string;
  publishedAt: string;
  category: string[];
  country: string;
}
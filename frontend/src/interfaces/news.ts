export interface NewsArticle {
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

export interface TopNewsPayload {
  status: 'success' | 'error';
  scope: string;
  data: NewsArticle[];
}

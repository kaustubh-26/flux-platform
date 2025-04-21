import { z } from "zod";

/**
 * Individual article schema
 */
export const ArticleSchema = z.object({
  article_id: z.string(),
  link: z.string().url(),

  title: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(),

  keywords: z.array(z.string()).nullable().default([]),
  creator: z.array(z.string()).nullable(),

  language: z.string(),
  country: z.array(z.string()),
  category: z.array(z.string()),

  datatype: z.literal("news"),

  pubDate: z.string(),      // keep string (API not ISO-safe)
  pubDateTZ: z.string(),
  fetched_at: z.string(),

  image_url: z.string().url().nullable(),
  video_url: z.string().url().nullable(),

  source_id: z.string(),
  source_name: z.string(),
  source_priority: z.number(),
  source_url: z.string().url(),
  source_icon: z.string().url(),

  sentiment: z.string().nullable(),
  sentiment_stats: z.string().nullable(),

  ai_tag: z.string().nullable(),
  ai_region: z.string().nullable(),
  ai_org: z.string().nullable(),
  ai_summary: z.string().nullable(),

  duplicate: z.boolean()
});

/**
 * Full API response schema
 */
export const NewsApiResponseSchema = z.object({
  status: z.enum(["success", "error"]),
  totalResults: z.number(),
  results: z.array(ArticleSchema),
  nextPage: z.string().optional()
});

export type Article = z.infer<typeof ArticleSchema>;
export type NewsApiResponse = z.infer<typeof NewsApiResponseSchema>;


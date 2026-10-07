import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(75),
      description: z.string().min(60).max(220),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      category: z.string(),
      tags: z.array(z.string()).max(6).default([]),
      image: image(),
      imageAlt: z.string(),
      imageCredit: z.object({ name: z.string(), url: z.string().url(), source: z.string() }).optional(),
      faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
      sources: z.array(z.object({ title: z.string(), url: z.string().url() })).default([]),
    }),
});

export const collections = { posts };

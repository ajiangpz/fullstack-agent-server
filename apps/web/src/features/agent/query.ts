import type { AiTaskQuery } from './types';

export function buildAiTaskQuery(query: AiTaskQuery) {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('limit', String(query.limit));

  const search = query.search?.trim();
  if (search) params.set('search', search);
  if (query.status) params.set('status', query.status);

  return params.toString();
}

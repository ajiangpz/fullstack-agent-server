'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ThemeDocumentSync } from '@/components/theme-document-sync';
import { LanguageDocumentSync } from '@/i18n/language-document-sync';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeDocumentSync />
      <LanguageDocumentSync />
      {children}
    </QueryClientProvider>
  );
}

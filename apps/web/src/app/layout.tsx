import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';

const themeInitScript = `
(() => {
  try {
    const savedTheme = window.localStorage.getItem('network-agent-theme');
    document.documentElement.dataset.theme =
      savedTheme === 'light' ? 'light' : 'dark';
  } catch {
    document.documentElement.dataset.theme = 'dark';
  }
})();
`;

export const metadata: Metadata = {
  title: 'Network Agent',
  description: 'AI-driven network device management and operations console',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

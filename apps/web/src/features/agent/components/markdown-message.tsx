'use client';

import { Fragment, type ReactNode } from 'react';

function safeHref(href: string): string | null {
  if (href.startsWith('/') || href.startsWith('#')) {
    return href;
  }

  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:' ? href : null;
  } catch {
    return null;
  }
}

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const tokens = text.split(
    /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)]+\))/g,
  );

  return tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;

    if (token.startsWith('**') && token.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold text-zinc-100">
          {token.slice(2, -2)}
        </strong>
      );
    }

    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={key}
          className="rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-[0.9em] text-zinc-200"
        >
          {token.slice(1, -1)}
        </code>
      );
    }

    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const safe = safeHref(href);

      if (safe) {
        return (
          <a
            key={key}
            href={safe}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300 underline decoration-cyan-500/40 underline-offset-4 hover:text-cyan-200"
          >
            {label}
          </a>
        );
      }
    }

    return <Fragment key={key}>{token}</Fragment>;
  });
}

function isBlockStart(line: string) {
  return (
    /^```(?:[\w-]+)?\s*$/.test(line) ||
    /^#{1,3}\s+/.test(line) ||
    /^\s*[-*]\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^\s*>\s?/.test(line)
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const fenceMatch = line.match(/^```([\w-]+)?\s*$/);
    if (fenceMatch) {
      const language = fenceMatch[1];
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push(
        <div key={`code-${index}`} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
          {language ? (
            <div className="border-b border-zinc-800 px-4 py-2 text-[11px] uppercase tracking-wide text-zinc-500">
              {language}
            </div>
          ) : null}
          <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6 text-zinc-200">
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>,
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const className =
        level === 1
          ? 'text-xl font-semibold text-zinc-100'
          : level === 2
            ? 'text-lg font-semibold text-zinc-100'
            : 'text-base font-semibold text-zinc-100';

      blocks.push(
        <div key={`heading-${index}`} className={className}>
          {renderInlineMarkdown(text, `heading-${index}`)}
        </div>,
      );
      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const match = lines[index].match(/^\s*[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }

      blocks.push(
        <ul
          key={`ul-${index}`}
          className="list-disc space-y-1.5 pl-6 marker:text-zinc-500"
        >
          {items.map((item, itemIndex) => (
            <li key={`ul-${index}-${itemIndex}`}>
              {renderInlineMarkdown(item, `ul-${index}-${itemIndex}`)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const match = lines[index].match(/^\s*\d+\.\s+(.+)$/);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }

      blocks.push(
        <ol
          key={`ol-${index}`}
          className="list-decimal space-y-1.5 pl-6 marker:text-zinc-500"
        >
          {items.map((item, itemIndex) => (
            <li key={`ol-${index}-${itemIndex}`}>
              {renderInlineMarkdown(item, `ol-${index}-${itemIndex}`)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];

      while (index < lines.length) {
        const match = lines[index].match(/^\s*>\s?(.*)$/);
        if (!match) break;
        quoteLines.push(match[1]);
        index += 1;
      }

      blocks.push(
        <blockquote
          key={`quote-${index}`}
          className="border-l-2 border-zinc-700 pl-4 text-zinc-400"
        >
          {quoteLines.map((quoteLine, quoteIndex) => (
            <Fragment key={`quote-${index}-${quoteIndex}`}>
              {renderInlineMarkdown(
                quoteLine,
                `quote-${index}-${quoteIndex}`,
              )}
              {quoteIndex < quoteLines.length - 1 ? <br /> : null}
            </Fragment>
          ))}
        </blockquote>,
      );
      continue;
    }

    const paragraphLines: string[] = [];

    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !isBlockStart(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="whitespace-pre-wrap">
        {paragraphLines.map((paragraphLine, paragraphIndex) => (
          <Fragment key={`paragraph-${index}-${paragraphIndex}`}>
            {renderInlineMarkdown(
              paragraphLine,
              `paragraph-${index}-${paragraphIndex}`,
            )}
            {paragraphIndex < paragraphLines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </p>,
    );
  }

  return (
    <div className="space-y-3 break-words text-sm leading-7 text-zinc-200">
      {blocks}
    </div>
  );
}

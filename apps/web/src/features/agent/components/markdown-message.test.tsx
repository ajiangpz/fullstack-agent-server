import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownMessage } from './markdown-message';

describe('MarkdownMessage', () => {
  it('renders numbered lists and bold text instead of raw markdown markers', () => {
    const html = renderToStaticMarkup(
      <MarkdownMessage
        content={'1. **Dell PowerSwitch S5248F-ON** (10.60.1.100)\n2. **FortiSwitch 248E** (10.60.1.96)'}
      />,
    );

    expect(html).toContain('<ol');
    expect(html).toContain('<strong');
    expect(html).toContain('Dell PowerSwitch S5248F-ON');
    expect(html).not.toContain('**Dell PowerSwitch S5248F-ON**');
  });

  it('does not turn unsafe link protocols into anchors', () => {
    const html = renderToStaticMarkup(
      <MarkdownMessage content={'[unsafe](javascript:alert(1))'} />,
    );

    expect(html).not.toContain('href=');
  });
});

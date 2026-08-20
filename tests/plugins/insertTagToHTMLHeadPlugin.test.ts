import { Readable } from 'node:stream';
import { parse } from 'node-html-parser';
import { describe, expect, it } from 'vitest';
import {
  insertTagToHTMLHeadPlugin,
  type InsertTagToHTMLHeadPluginOptions,
} from '../../src/plugins/insertTagToHTMLHeadPlugin';
import type { DeploymentMode } from '../../src/types';
import { readStreamText } from '../../src/utils';

describe('insertTagToHTMLHeadPlugin', () => {
  it('inserts configured tags before and after the existing head children in order', async () => {
    const result = await transformHTML({
      html: '<html><head><title>Example</title></head><body><main>Content</main></body></html>',
      options: {
        prepend: [
          { tag: 'meta', attributes: { charset: 'utf-8' } },
          { tag: 'link', attributes: { rel: 'stylesheet', href: '/app.css' } },
        ],
        append: [{ tag: 'script', attributes: { src: '/app.js', defer: '' } }],
      },
    });

    expect(result).toBeTypeOf('string');
    const dom = parse(result as string);
    expect(dom.querySelector('head')?.childNodes.map((node) => node.toString())).toEqual([
      '<meta charset="utf-8">',
      '<link rel="stylesheet" href="/app.css">',
      '<title>Example</title>',
      '<script src="/app.js" defer></script>',
    ]);
    expect(dom.querySelector('body')?.toString()).toBe('<body><main>Content</main></body>');
  });

  it.each(['index.html', 'index.htm'])('transforms supported HTML file %s', async (name) => {
    const result = await transformHTML({
      name,
      html: '<html><head><title>Example</title></head></html>',
      options: { append: [{ tag: 'meta', attributes: { name: 'robots', content: 'noindex' } }] },
    });

    expect(parse(result as string).querySelector('meta')?.attributes).toEqual({
      name: 'robots',
      content: 'noindex',
    });
  });

  it('only transforms files in the configured deployment modes', async () => {
    const options: InsertTagToHTMLHeadPluginOptions = {
      targetModes: ['s3'],
      prepend: [{ tag: 'meta', attributes: { name: 'environment', content: 'production' } }],
    };

    await expect(transformHTML({ options, mode: 'zip' })).resolves.toBeUndefined();
    await expect(transformHTML({ options, mode: 's3' })).resolves.toContain(
      '<meta name="environment" content="production">',
    );
  });

  it('leaves non-HTML streams unread for subsequent processing', async () => {
    const stream = Readable.from(['body { color: red; }']);
    const plugin = insertTagToHTMLHeadPlugin({ prepend: [{ tag: 'meta' }] });

    await expect(plugin.transform?.({ name: 'styles.css', stream, mode: 'copy' })).resolves.toBeUndefined();
    await expect(readStreamText(stream)).resolves.toBe('body { color: red; }');
  });

  it('does not produce transformed content when the document has no head', async () => {
    await expect(
      transformHTML({
        html: '<html><body><main>Content</main></body></html>',
        options: { prepend: [{ tag: 'meta' }] },
      }),
    ).resolves.toBeUndefined();
  });
});

function transformHTML({
  html = '<html><head></head><body></body></html>',
  name = 'index.html',
  mode = 'copy',
  options,
}: {
  html?: string;
  name?: string;
  mode?: DeploymentMode;
  options: InsertTagToHTMLHeadPluginOptions;
}) {
  const plugin = insertTagToHTMLHeadPlugin(options);
  return plugin.transform?.({ name, stream: Readable.from([html]), mode });
}

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { parse } from 'node-html-parser';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../src/config.js';
import { deploy } from '../src/deploy.js';
import { deployZip } from '../src/deploy/zip.js';
import type { Plugin } from '../src/plugin.js';
import { insertTagToHTMLHeadPlugin } from '../src/plugins/insertTagToHTMLHeadPlugin.js';
import { createTempDir } from './helpers.js';
import { readZipEntries } from './zip-entries.js';

describe('ZIP deployment', () => {
  it('creates an archive containing transformed files and normalized paths', async () => {
    const dir = await createTempDir();
    const inputDir = join(dir, 'input');
    const outputPath = join(dir, 'artifacts', 'site.zip');
    await mkdir(join(inputDir, 'assets'), { recursive: true });
    await Promise.all([
      writeFile(join(inputDir, 'index.html'), '<html><head><title>Site</title></head><body></body></html>', 'utf-8'),
      writeFile(join(inputDir, 'assets', 'data.bin'), Buffer.from([0, 1, 2, 255])),
    ]);

    const config: Config = {
      zip: { output: outputPath },
      copy: { outDir: join(dir, 'copy') },
      s3: { bucket: '' },
      plugins: [
        insertTagToHTMLHeadPlugin({
          targetModes: ['zip'],
          prepend: [{ tag: 'meta', attributes: { name: 'deployment', content: 'zip' } }],
        }),
      ],
    };

    await deployZip(inputDir, config);

    const entries = await readZipEntries(outputPath);
    expect([...entries.keys()].sort()).toEqual(['assets/data.bin', 'index.html']);
    expect(entries.get('assets/data.bin')).toEqual(Buffer.from([0, 1, 2, 255]));

    const html = parse(entries.get('index.html')!.toString('utf-8'));
    const headChildren = html.querySelector('head')!.childNodes;
    expect(headChildren[0].toString()).toBe('<meta name="deployment" content="zip">');
    expect(headChildren[1].toString()).toBe('<title>Site</title>');
  });

  it('reports input stream failures to deployEnd', async () => {
    const dir = await createTempDir();
    const inputDir = join(dir, 'input');
    await mkdir(inputDir);
    await writeFile(join(inputDir, 'file.txt'), 'source', 'utf-8');
    const expectedError = new Error('archive input failed');
    const deployEnd = vi.fn();
    const plugin: Plugin = {
      transform() {
        return Readable.from(
          (async function* () {
            yield 'partial';
            throw expectedError;
          })(),
        );
      },
      deployEnd,
    };
    const config: Config = {
      zip: { output: join(dir, 'output.zip') },
      copy: { outDir: join(dir, 'copy') },
      s3: { bucket: '' },
      plugins: [plugin],
    };

    await expect(deploy('zip', inputDir, config)).rejects.toBe(expectedError);
    expect(deployEnd).toHaveBeenCalledOnce();
    expect(deployEnd).toHaveBeenCalledWith(expectedError);
  });
});

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../../src/config';
import { deployCopy } from '../../src/deploy/copy';
import { deploy } from '../../src/deploy/deploy';
import type { Plugin } from '../../src/plugin';
import { readStreamText } from '../../src/utils';
import { createTempDir } from '../helpers';

describe('copy deployment', () => {
  it('copies the selected tree, transforms contents, and runs lifecycle hooks', async () => {
    const dir = await createTempDir();
    const inputDir = join(dir, 'input');
    const outputDir = join(dir, 'output');
    const ignoreFile = join(dir, '.deployment-zip-ignore');
    await mkdir(join(inputDir, 'nested'), { recursive: true });
    await Promise.all([
      writeFile(join(inputDir, 'keep.txt'), 'root', 'utf-8'),
      writeFile(join(inputDir, 'nested', 'keep.txt'), 'nested', 'utf-8'),
      writeFile(join(inputDir, 'ignored-by-config.txt'), 'ignored', 'utf-8'),
      writeFile(join(inputDir, 'nested', 'ignored-by-file.txt'), 'ignored', 'utf-8'),
      writeFile(ignoreFile, 'nested/ignored-by-file.txt\n', 'utf-8'),
    ]);

    const events: string[] = [];
    const deployEnd = vi.fn<(error?: Error) => void>((error) => events.push(error ? 'end:error' : 'end'));
    const plugin: Plugin = {
      options(config) {
        events.push('options');
        return config;
      },
      deployStart() {
        events.push('start');
      },
      async transform({ name, stream, mode }) {
        events.push(`transform:${mode}:${basename(name)}`);
        return (await readStreamText(stream)).toUpperCase();
      },
      deployEnd,
    };

    await deploy(
      'copy',
      inputDir,
      createConfig(outputDir, {
        ignores: ['ignored-by-config.txt'],
        ignoreFile,
        plugins: [plugin],
      }),
    );

    await expect(readFile(join(outputDir, 'keep.txt'), 'utf-8')).resolves.toBe('ROOT');
    await expect(readFile(join(outputDir, 'nested', 'keep.txt'), 'utf-8')).resolves.toBe('NESTED');
    await expect(stat(join(outputDir, 'ignored-by-config.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(join(outputDir, 'nested', 'ignored-by-file.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(events.slice(0, 2)).toEqual(['options', 'start']);
    expect(events.filter((event) => event.startsWith('transform:')).sort()).toEqual([
      'transform:copy:keep.txt',
      'transform:copy:keep.txt',
    ]);
    expect(events.at(-1)).toBe('end');
    expect(deployEnd).toHaveBeenCalledWith();
  });

  it('resolves only after transformed streams have been written', async () => {
    const dir = await createTempDir();
    const inputDir = join(dir, 'input');
    const outputDir = join(dir, 'output');
    await mkdir(inputDir);
    await writeFile(join(inputDir, 'delayed.txt'), 'source', 'utf-8');

    const plugin: Plugin = {
      transform() {
        return Readable.from(
          (async function* () {
            await new Promise<void>((resolve) => setTimeout(resolve, 10));
            yield 'transformed';
          })(),
        );
      },
    };

    await deployCopy(inputDir, createConfig(outputDir, { plugins: [plugin] }));

    await expect(readFile(join(outputDir, 'delayed.txt'), 'utf-8')).resolves.toBe('transformed');
  });

  it('reports stream failures to deployEnd', async () => {
    const dir = await createTempDir();
    const inputDir = join(dir, 'input');
    const outputDir = join(dir, 'output');
    await mkdir(inputDir);
    await writeFile(join(inputDir, 'file.txt'), 'source', 'utf-8');
    const expectedError = new Error('transform failed');
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

    await expect(deploy('copy', inputDir, createConfig(outputDir, { plugins: [plugin] }))).rejects.toBe(expectedError);
    expect(deployEnd).toHaveBeenCalledOnce();
    expect(deployEnd).toHaveBeenCalledWith(expectedError);
  });
});

function createConfig(outputDir: string, overrides: Partial<Config> = {}): Config {
  return {
    zip: { output: join(outputDir, 'output.zip') },
    copy: { outDir: outputDir },
    s3: { bucket: '' },
    plugins: [],
    ...overrides,
  };
}

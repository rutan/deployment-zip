import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { getFilesRecursively, loadConfig, readStreamBuffer, readStreamText } from '../src/utils';
import { createTempDir } from './helpers';

describe('utils', () => {
  it('loads data and executable config formats', async () => {
    const dir = await createTempDir();
    const jsonPath = join(dir, 'config.json');
    const tsPath = join(dir, 'config.ts');
    await writeFile(jsonPath, JSON.stringify({ root: 'public' }), 'utf-8');
    await writeFile(tsPath, "export default { root: 'dist' };\n", 'utf-8');

    await expect(loadConfig(jsonPath)).resolves.toEqual({ root: 'public' });
    await expect(loadConfig(tsPath)).resolves.toEqual({ root: 'dist' });
    await expect(loadConfig(join(dir, 'config.txt'))).rejects.toThrow('Unsupported config file type');
  });

  it('getFilesRecursively returns nested files', async () => {
    const dir = await createTempDir();
    const nestedDir = join(dir, 'nested');
    await mkdir(nestedDir);
    const topFile = join(dir, 'a.txt');
    const nestedFile = join(nestedDir, 'b.txt');
    await writeFile(topFile, 'a', 'utf-8');
    await writeFile(nestedFile, 'b', 'utf-8');

    const files = await getFilesRecursively(dir);
    const sorted = files.map((file) => file.replace(/\\/g, '/')).sort();

    expect(sorted).toEqual([topFile, nestedFile].map((file) => file.replace(/\\/g, '/')).sort());
  });

  it('readStreamBuffer aggregates buffer data', async () => {
    const stream = Readable.from([Buffer.from('foo'), Buffer.from('bar')]);
    await expect(readStreamBuffer(stream)).resolves.toEqual(Buffer.from('foobar'));
  });

  it('readStreamText correctly handles multi-byte UTF-8 characters', async () => {
    const buffer = Buffer.from('テスト', 'utf-8');
    const stream = readableFromChunks(buffer, Array(buffer.length).fill(1));
    await expect(readStreamText(stream)).resolves.toBe('テスト');
  });
});

function readableFromChunks(buf: Buffer, chunkSizes: number[]) {
  let offset = 0;
  let i = 0;

  return new Readable({
    read() {
      if (offset >= buf.length) {
        this.push(null);
        return;
      }
      const size = chunkSizes[i] ?? chunkSizes[chunkSizes.length - 1] ?? 1;
      i++;
      const end = Math.min(offset + size, buf.length);
      this.push(buf.subarray(offset, end));
      offset = end;
    },
  });
}

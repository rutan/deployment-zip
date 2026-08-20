import { mkdir, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { inflateRawSync } from 'node:zlib';
import { parse } from 'node-html-parser';
import { describe, expect, it, vi } from 'vitest';
import type { Config } from '../../src/config';
import { deploy } from '../../src/deploy/deploy';
import { deployZip } from '../../src/deploy/zip';
import type { Plugin } from '../../src/plugin';
import { createTempDir } from '../helpers';

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
    };

    await deployZip(inputDir, config);

    const entries = await readZipEntries(outputPath);
    expect([...entries.keys()].sort()).toEqual(['assets/data.bin', 'index.html']);
    expect(entries.get('assets/data.bin')).toEqual(Buffer.from([0, 1, 2, 255]));

    const html = parse(entries.get('index.html')!.toString('utf-8'));
    const headChildren = html.querySelector('head')!.childNodes;
    expect(headChildren[0].toString()).toBe('<title>Site</title>');
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

const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

async function readZipEntries(path: string) {
  const zip = await readFile(path);
  const endOffset = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(endOffset + 10);
  let centralOffset = zip.readUInt32LE(endOffset + 16);
  const entries = new Map<string, Buffer>();

  for (let index = 0; index < entryCount; index++) {
    if (zip.readUInt32LE(centralOffset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('Invalid ZIP central directory');
    }

    const compressionMethod = zip.readUInt16LE(centralOffset + 10);
    const compressedSize = zip.readUInt32LE(centralOffset + 20);
    const fileNameLength = zip.readUInt16LE(centralOffset + 28);
    const extraLength = zip.readUInt16LE(centralOffset + 30);
    const commentLength = zip.readUInt16LE(centralOffset + 32);
    const localOffset = zip.readUInt32LE(centralOffset + 42);
    const fileName = zip.subarray(centralOffset + 46, centralOffset + 46 + fileNameLength).toString('utf-8');

    if (zip.readUInt32LE(localOffset) !== LOCAL_FILE_SIGNATURE) {
      throw new Error('Invalid ZIP local file header');
    }

    const localFileNameLength = zip.readUInt16LE(localOffset + 26);
    const localExtraLength = zip.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);

    switch (compressionMethod) {
      case 0:
        entries.set(fileName, compressed);
        break;
      case 8:
        entries.set(fileName, inflateRawSync(compressed));
        break;
      default:
        throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
    }

    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(zip: Buffer) {
  const minimumOffset = Math.max(0, zip.length - 65_557);
  for (let offset = zip.length - 22; offset >= minimumOffset; offset--) {
    if (zip.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) return offset;
  }
  throw new Error('ZIP end of central directory not found');
}

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../../src/config';
import type { Plugin } from '../../src/plugin';
import { createTempDir } from '../helpers';

type UploadRecord = {
  bucket: string;
  key: string;
  contentType: string;
  body: Buffer;
};

const uploadRecords = vi.hoisted(() => [] as UploadRecord[]);

vi.mock('@aws-sdk/lib-storage', () => ({
  Upload: class {
    constructor(
      private readonly options: {
        params: {
          Bucket: string;
          Key: string;
          ContentType: string;
          Body: AsyncIterable<Uint8Array | string>;
        };
      },
    ) {}

    async done() {
      const chunks: Buffer[] = [];
      for await (const chunk of this.options.params.Body) chunks.push(Buffer.from(chunk));
      uploadRecords.push({
        bucket: this.options.params.Bucket,
        key: this.options.params.Key,
        contentType: this.options.params.ContentType,
        body: Buffer.concat(chunks),
      });
    }
  },
}));

const { deployS3 } = await import('../../src/deploy/s3.js');

describe('S3 deployment', () => {
  beforeEach(() => {
    uploadRecords.length = 0;
  });

  it('uploads transformed contents with prefixed keys and MIME types', async () => {
    const dir = await createTempDir();
    const inputDir = join(dir, 'input');
    await mkdir(join(inputDir, 'nested'), { recursive: true });
    await Promise.all([
      writeFile(join(inputDir, 'nested', 'index.html'), '<html></html>', 'utf-8'),
      writeFile(join(inputDir, 'payload'), 'binary-ish', 'utf-8'),
    ]);
    const plugin: Plugin = {
      transform({ name }) {
        if (name.endsWith('.html')) return '<html>transformed</html>';
        return undefined;
      },
    };

    await deployS3(inputDir, createConfig({ keyPrefix: 'releases/v1', plugins: [plugin] }));

    expect(
      uploadRecords
        .map(({ bucket, key, contentType, body }) => ({ bucket, key, contentType, body: body.toString('utf-8') }))
        .sort((left, right) => left.key.localeCompare(right.key)),
    ).toEqual([
      {
        bucket: 'deployment-bucket',
        key: 'releases/v1/nested/index.html',
        contentType: 'text/html',
        body: '<html>transformed</html>',
      },
      {
        bucket: 'deployment-bucket',
        key: 'releases/v1/payload',
        contentType: 'application/octet-stream',
        body: 'binary-ish',
      },
    ]);
  });

  it('rejects a missing bucket with an Error', async () => {
    const dir = await createTempDir();
    await expect(deployS3(dir, createConfig({ bucket: '' }))).rejects.toThrow('s3.bucket is required');
  });
});

function createConfig({ plugins = [], ...s3 }: Partial<Config['s3']> & { plugins?: Plugin[] } = {}): Config {
  return {
    zip: { output: 'output.zip' },
    copy: { outDir: 'output' },
    s3: {
      bucket: 'deployment-bucket',
      region: 'ap-northeast-1',
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key',
      ...s3,
    },
    plugins,
  };
}

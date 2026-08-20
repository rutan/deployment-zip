import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDeploymentZipConfig } from '../src/config';
import { createTempDir } from './helpers';

describe('loadDeploymentZipConfig', () => {
  it('merges user settings with nested defaults', async () => {
    const dir = await createTempDir();
    const configPath = join(dir, 'deployment-zip.json');
    await writeFile(
      configPath,
      JSON.stringify({
        ignores: ['*.map'],
        copy: { outDir: 'release' },
      }),
      'utf-8',
    );

    await expect(loadDeploymentZipConfig(configPath)).resolves.toEqual({
      ignores: ['*.map'],
      zip: { output: 'output.zip' },
      copy: { outDir: 'release' },
      s3: { bucket: '' },
      plugins: [],
    });
  });
});

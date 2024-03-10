import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { consola } from 'consola';
import type { Config } from '../config.js';
import { eachDeployFiles } from './common.js';

export async function deployCopy(inputDir: string, config: Config) {
  const outputDirName = typeof config.copy.outDir === 'function' ? config.copy.outDir(inputDir) : config.copy.outDir;

  consola.start(`Deploying ${inputDir} to ${outputDirName}`);

  await mkdir(outputDirName, { recursive: true });

  await eachDeployFiles(
    {
      mode: 'copy',
      inputDir,
      config,
      parallel: true,
    },
    async ({ relativePath, inputStream }) => {
      const writePath = join(outputDirName, relativePath);
      await mkdir(dirname(writePath), { recursive: true });

      const outputStream = createWriteStream(join(outputDirName, relativePath));
      inputStream.pipe(outputStream);
    },
  );

  consola.success(`Created ${outputDirName}`);
}

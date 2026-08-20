import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { consola } from 'consola';
import type { Config } from '../config';
import { eachDeployFiles } from './common';

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

      const outputStream = createWriteStream(writePath);
      await pipeline(inputStream, outputStream);
    },
  );

  consola.success(`Created ${outputDirName}`);
}

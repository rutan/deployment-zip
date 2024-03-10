import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import archiver from 'archiver';
import { consola } from 'consola';
import type { Config } from '../config.js';
import { eachDeployFiles } from './common.js';

export async function deployZip(inputDir: string, config: Config) {
  const outputFileName = typeof config.zip.output === 'function' ? config.zip.output(inputDir) : config.zip.output;

  consola.start(`Deploying ${inputDir} to ${outputFileName}`);

  await mkdir(dirname(outputFileName), { recursive: true });

  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  await eachDeployFiles(
    {
      mode: 'zip',
      inputDir,
      config,
      parallel: true,
    },
    async ({ relativePath, inputStream }) => {
      archive.append(inputStream, { name: relativePath });
    },
  );

  return new Promise<void>((resolve, reject) => {
    const outputStream = createWriteStream(outputFileName);
    outputStream.on('close', () => {
      consola.success(`Created ${outputFileName} (${archive.pointer()} bytes)`);
      resolve();
    });
    outputStream.on('error', (e) => reject(e));
    archive.pipe(outputStream);
    archive.finalize();
  });
}

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { Readable } from 'node:stream';
import archiver from 'archiver';
import { consola } from 'consola';
import { colorize } from 'consola/utils';
import ignore, { type Ignore } from 'ignore';
import type { Config } from './config.js';
import { getFilesRecursively } from './utils.js';

export async function createIgnore(config: Config) {
  // @ts-ignore
  const ig: Ignore = ignore();

  if (config.ignores) ig.add(config.ignores);
  if (config.ignoreFile) {
    const ignoreFiles = Array.isArray(config.ignoreFile) ? config.ignoreFile : [config.ignoreFile];
    for (const file of ignoreFiles) {
      const ignoreFile = await readFile(file, 'utf-8');
      ig.add(ignoreFile.split('\n').filter(Boolean));
    }
  }

  return ig;
}

export async function buildReadStream({
  inputFile,
  config,
  mode,
}: {
  inputFile: string;
  config: Config;
  mode: 'zip' | 'copy';
}) {
  let stream: Readable = createReadStream(inputFile);

  for (const plugin of config.plugins ?? []) {
    const result = plugin.transform && (await plugin.transform({ name: inputFile, stream, mode }));
    if (result instanceof Readable) stream = result;
    if (typeof result === 'string') stream = Readable.from(result);
  }

  return stream;
}

export async function deployZip(targetDir: string, config: Config) {
  const outputFileName = typeof config.zip.output === 'function' ? config.zip.output(targetDir) : config.zip.output;
  const ig = await createIgnore(config);

  consola.start(`Deploying ${targetDir} to ${outputFileName}`);

  await mkdir(dirname(outputFileName), { recursive: true });

  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  const files = await getFilesRecursively(targetDir);
  await Promise.all(
    files.map(async (file) => {
      const relativePath = relative(targetDir, file);
      if (ig.ignores(relativePath)) {
        consola.log(colorize('gray', `skip ${relativePath}`));
      } else {
        consola.log(colorize('green', `add ${relativePath}`));
        const inputStream = await buildReadStream({
          inputFile: file,
          config,
          mode: 'zip',
        });
        archive.append(inputStream, { name: relativePath });
      }
    }),
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

export async function deployCopy(targetDir: string, config: Config) {
  const outputDirName = typeof config.copy.outDir === 'function' ? config.copy.outDir(targetDir) : config.copy.outDir;
  const ig = await createIgnore(config);

  consola.start(`Deploying ${targetDir} to ${outputDirName}`);

  await mkdir(outputDirName, { recursive: true });

  const files = await getFilesRecursively(targetDir);
  await Promise.all(
    files.map(async (file) => {
      const relativePath = relative(targetDir, file);
      if (ig.ignores(relativePath)) {
        consola.log(colorize('gray', `skip ${relativePath}`));
      } else {
        consola.log(colorize('green', `add ${relativePath}`));

        const writePath = join(outputDirName, relativePath);
        await mkdir(dirname(writePath), { recursive: true });

        const outputStream = createWriteStream(join(outputDirName, relativePath));
        const inputStream = await buildReadStream({
          inputFile: file,
          config,
          mode: 'copy',
        });
        inputStream.pipe(outputStream);
      }
    }),
  );

  consola.success(`Created ${outputDirName}`);
}

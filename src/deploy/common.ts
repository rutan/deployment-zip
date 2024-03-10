import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { Readable } from 'node:stream';
import { consola } from 'consola';
import { colorize } from 'consola/utils';
import ignore, { type Ignore } from 'ignore';
import type { Config } from '../config.js';
import { callPluginHook } from '../plugin.js';
import type { DeploymentMode } from '../types.js';
import { getFilesRecursively } from '../utils.js';

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
  mode: DeploymentMode;
}) {
  const [{ stream }] = await callPluginHook({
    plugins: config.plugins,
    hook: 'transform',
    args: [
      {
        name: inputFile,
        stream: createReadStream(inputFile),
        mode,
      },
    ],
    argsHook: ([params], result) => {
      if (result instanceof Readable) return [{ ...params, stream: result }] as const;
      if (typeof result === 'string') return [{ ...params, stream: Readable.from(result) }] as const;
      return [params] as const;
    },
  });

  return stream;
}

export async function eachDeployFiles(
  {
    mode,
    inputDir,
    config,
    parallel,
  }: {
    mode: DeploymentMode;
    inputDir: string;
    config: Config;
    parallel?: boolean;
  },
  cb: (obj: {
    file: string;
    relativePath: string;
    inputStream: Readable;
  }) => Promise<void>,
): Promise<void> {
  const ig = await createIgnore(config);
  const files = await getFilesRecursively(inputDir);
  const taskFunc = async (file: string) => {
    const relativePath = relative(inputDir, file);
    if (ig.ignores(relativePath)) {
      consola.log(colorize('gray', `skip ${relativePath}`));
    } else {
      consola.log(colorize('green', `add ${relativePath}`));
      await cb({
        file,
        relativePath,
        inputStream: await buildReadStream({
          inputFile: file,
          config,
          mode,
        }),
      });
    }
  };

  if (parallel) {
    await Promise.all(files.map(taskFunc));
    return;
  }

  for (const file of files) {
    await taskFunc(file);
  }
}

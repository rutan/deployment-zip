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
    parallel?: boolean | number;
  },
  cb: (obj: {
    file: string;
    relativePath: string;
    inputStream: Readable;
  }) => Promise<void>,
): Promise<void> {
  const ig = await createIgnore(config);
  const files = await getFilesRecursively(inputDir);
  const tasks: Promise<void>[] = [];

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

  function enqueue(file: string) {
    const task = taskFunc(file).finally(() => {
      const nextFile = files.shift();
      if (nextFile) enqueue(nextFile);
    });
    tasks.push(task);
  }

  const parallelCount = typeof parallel === 'number' ? parallel : parallel ? 10 : 1;
  for (let i = 0; i < parallelCount; ++i) {
    const file = files.shift();
    if (file) enqueue(file);
  }

  for (let i = 0; i < tasks.length; ++i) {
    await tasks[i];
  }
}

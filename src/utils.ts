import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import createJITI from 'jiti';

export async function loadConfig(configFilePath: string) {
  if (
    configFilePath.endsWith('.ts') ||
    configFilePath.endsWith('.js') ||
    configFilePath.endsWith('.cjs') ||
    configFilePath.endsWith('.mjs')
  ) {
    return loadTsConfig(configFilePath);
  }
  if (configFilePath.endsWith('.json')) return loadJSONConfig(configFilePath);

  throw new Error('Unsupported config file type');
}

export async function loadTsConfig(configFilePath: string) {
  const __filename = fileURLToPath(import.meta.url);

  // @ts-ignore
  const jiti = createJITI(__filename);
  const module = jiti(resolve(configFilePath));

  return module.default || module;
}

export async function loadJSONConfig(configFilePath: string) {
  return JSON.parse(await readFile(configFilePath, 'utf-8'));
}

export async function getFilesRecursively(dir: string) {
  let files: string[] = [];

  const dirFiles = await readdir(dir);
  for (const file of dirFiles) {
    const filePath = join(dir, file);
    if ((await stat(filePath)).isDirectory()) {
      files = [...files, ...(await getFilesRecursively(filePath))];
    } else {
      files.push(filePath);
    }
  }

  return files;
}
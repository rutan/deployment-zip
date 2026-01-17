import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { StringDecoder } from 'node:string_decoder';
import { createJiti } from 'jiti';
import type { Config } from './config.js';

export async function loadConfig(configFilePath: string): Promise<Config> {
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

export async function loadTsConfig(configFilePath: string): Promise<Config> {
  const __filename = fileURLToPath(import.meta.url);

  const jiti = createJiti(__filename);
  return await jiti.import(resolve(configFilePath), {
    default: true,
  });
}

export async function loadJSONConfig(configFilePath: string): Promise<Config> {
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

export function readStreamBuffer(stream: Readable) {
  return new Promise<Buffer>((resolve, reject) => {
    let data = Buffer.from('');
    stream.on('data', (chunk: Buffer) => {
      data = Buffer.concat([data, chunk]);
    });
    stream.on('end', () => resolve(data));
    stream.on('error', reject);
  });
}

export function readStreamText(stream: Readable) {
  return new Promise<string>((resolve, reject) => {
    const decoder = new StringDecoder('utf8');
    const data: string[] = [];

    stream.on('data', (chunk: Buffer) => {
      data.push(decoder.write(chunk));
    });
    stream.on('end', () => {
      data.push(decoder.end());
      resolve(data.join(''));
    });
    stream.on('error', reject);
  });
}

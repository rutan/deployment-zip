import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { loadConfig } from './utils.js';

type Promisable<T> = T | Promise<T>;

export interface Config {
  ignores?: string[];
  ignoreFile?: string | string[];
  zip: {
    output: string | ((targetDir: string) => string);
  };
  copy: {
    outDir: string | ((targetDir: string) => string);
  };
  plugins?: {
    transform?: (args: {
      name: string;
      stream: Readable;
      mode: 'zip' | 'copy';
    }) => Promisable<Readable | string | undefined>;
  }[];
}

const DEFAULT_CONFIG = {
  zip: {
    output: 'output.zip',
  },
  copy: {
    outDir: 'output',
  },
  plugins: [],
} satisfies Config;

export function defineConfig(config: Partial<Config>) {
  return config;
}

export async function loadDeploymentZipConfig(configFilePath: string): Promise<Config> {
  const config = await loadConfig(configFilePath);
  return {
    ...DEFAULT_CONFIG,
    ...config,
    zip: {
      ...DEFAULT_CONFIG.zip,
      ...config.zip,
    },
    copy: {
      ...DEFAULT_CONFIG.copy,
      ...config.copy,
    },
  };
}

export async function loadPackageJSON(): Promise<Record<string, any>> {
  const __dirname = new URL('.', import.meta.url).pathname;
  return JSON.parse(await readFile(resolve(__dirname, '../package.json'), 'utf-8'));
}

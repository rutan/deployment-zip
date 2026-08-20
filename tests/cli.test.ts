import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTempDir } from './helpers';

const require = createRequire(import.meta.url);
const jitiCli = join(dirname(require.resolve('jiti/package.json')), 'lib', 'jiti-cli.mjs');
const cliPath = resolve('src/cli.ts');

describe('CLI', () => {
  it('runs a copy deployment from command-line arguments', async () => {
    const dir = await createTempDir();
    const inputDir = join(dir, 'input');
    const outputDir = join(dir, 'output');
    const configPath = join(dir, 'deployment-zip.json');
    await mkdir(inputDir);
    await Promise.all([
      writeFile(join(inputDir, 'index.txt'), 'deployed', 'utf-8'),
      writeFile(
        configPath,
        JSON.stringify({
          copy: { outDir: outputDir },
        }),
        'utf-8',
      ),
    ]);

    const exitCode = await runCLI([inputDir, '--config', configPath, '--mode', 'copy']);

    expect(exitCode).toBe(0);
    await expect(readFile(join(outputDir, 'index.txt'), 'utf-8')).resolves.toBe('deployed');
  });

  it('returns a failure status for an invalid mode', async () => {
    const exitCode = await runCLI(['input', '--mode', 'invalid']);

    expect(exitCode).toBe(1);
  });
});

function runCLI(args: string[]) {
  return new Promise<number | null>((resolvePromise, reject) => {
    const child = spawn(process.execPath, [jitiCli, cliPath, ...args], {
      cwd: resolve('.'),
      env: { ...process.env, NO_COLOR: '1' },
      stdio: 'ignore',
    });
    child.on('error', reject);
    child.on('close', resolvePromise);
  });
}

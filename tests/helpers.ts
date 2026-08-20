import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished } from 'vitest';

export async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'deployment-zip-'));
  onTestFinished(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

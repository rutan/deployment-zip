import type { Config } from './config.js';
import { deployCopy, deployS3, deployZip } from './deploy/index.js';
import type { DeploymentMode } from './types.js';

export async function deploy(mode: DeploymentMode, inputDir: string, config: Config) {
  switch (mode) {
    case 'zip':
      return deployZip(inputDir, config);
    case 'copy':
      return deployCopy(inputDir, config);
    case 's3':
      return deployS3(inputDir, config);
    default:
      throw new Error(`unknown mode: ${mode}`);
  }
}

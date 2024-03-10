import { resolve } from 'node:path';
import { defineCommand, runMain, showUsage } from 'citty';
import { consola } from 'consola';
import { loadDeploymentZipConfig, loadPackageJSON } from './config.js';
import { deploy } from './deploy.js';
import { isDeploymentMode } from './types.js';

(async () => {
  const { name, version, description } = await loadPackageJSON();
  const main = defineCommand({
    meta: {
      name: name.split('/').pop(),
      version,
      description,
    },
    args: {
      config: {
        type: 'string',
        description: 'config file path [.deploment-zip.js]',
        alias: 'c',
        default: '.deployment-zip.js',
      },
      mode: {
        type: 'string',
        description: 'deploy mode [zip, raw, s3]',
        alias: 'm',
        default: 'zip',
      },
    } as const,
    async run({ args, cmd }) {
      const inputDir = args._[0];
      if (!inputDir) {
        await showUsage(cmd);
        process.exit(0);
      }

      if (!isDeploymentMode(args.mode)) {
        consola.error(`Invalid mode: ${args.mode}`);
        process.exit(1);
      }

      consola.info(`load config: ${resolve(args.config)}`);
      const config = await loadDeploymentZipConfig(args.config);
      await deploy(args.mode, inputDir, config);
    },
  });

  try {
    await runMain(main);
  } catch (e) {
    consola.error(e);
    process.exit(1);
  }
})();

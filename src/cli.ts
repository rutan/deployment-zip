import { resolve } from 'node:path';
import { defineCommand, runMain, showUsage } from 'citty';
import { consola } from 'consola';
import { loadDeploymentZipConfig, loadPackageJSON } from './config.js';
import { deployCopy, deployZip } from './deploy.js';

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
      const targetDir = args._[0];
      if (!targetDir) {
        await showUsage(cmd);
        process.exit(0);
      }

      consola.info(`load config: ${resolve(args.config)}`);
      const config = await loadDeploymentZipConfig(args.config);

      switch (args.mode) {
        case 'zip':
          await deployZip(targetDir, config);
          break;
        case 'copy':
          await deployCopy(targetDir, config);
          break;
        case 's3':
          consola.error('not implemented');
          break;
        default:
          consola.error(`unknown mode: ${args.mode}`);
          process.exit(1);
      }
    },
  });

  try {
    await runMain(main);
  } catch (e) {
    consola.error(e);
    process.exit(1);
  }
})();

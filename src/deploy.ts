import type { Config } from './config.js';
import { deployCopy, deployS3, deployZip } from './deploy/index.js';
import { callPluginHook } from './plugin.js';
import type { DeploymentMode } from './types.js';

export async function deploy(mode: DeploymentMode, inputDir: string, userConfig: Config) {
  const [config] = await callPluginHook({
    plugins: userConfig.plugins,
    hook: 'options',
    args: [userConfig],
    argsHook: (args, newConfig) => {
      if (newConfig) return [newConfig] as const;
      return args;
    },
  });

  await callPluginHook({
    plugins: config.plugins,
    hook: 'deployStart',
    args: [config],
  });

  try {
    switch (mode) {
      case 'zip':
        await deployZip(inputDir, config);
        break;
      case 'copy':
        await deployCopy(inputDir, config);
        break;
      case 's3':
        await deployS3(inputDir, config);
        break;
      default:
        throw new Error(`unknown mode: ${mode}`);
    }
  } catch (e) {
    await callPluginHook({
      plugins: config.plugins,
      hook: 'deployEnd',
      args: [e as Error],
    });
    throw e;
  }

  await callPluginHook({
    plugins: config.plugins,
    hook: 'deployEnd',
    args: [],
  });
}

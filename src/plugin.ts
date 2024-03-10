import type { Readable } from 'node:stream';
import type { Config } from './config.js';
import type { DeploymentMode, ParametersType, Promisable } from './types.js';

export type Plugin = {
  name?: string;
  options?: (config: Config) => Promisable<Config | undefined>;
  deployStart?: (config: Config) => void;
  deployEnd?: (error?: Error) => void;
  transform?: (args: {
    name: string;
    stream: Readable;
    mode: DeploymentMode;
  }) => Promisable<Readable | string | undefined>;
};
type PluginHooks = Omit<Plugin, 'name'>;

export async function callPluginHook<T extends keyof PluginHooks>({
  plugins,
  hook: hookName,
  args,
  argsHook,
}: {
  plugins?: Plugin[];
  hook: T;
  args: ParametersType<Required<PluginHooks>>[T];
  argsHook?: (
    currentArgs: ParametersType<Required<PluginHooks>>[T],
    response: Awaited<ReturnType<Required<PluginHooks>[T]>>,
  ) => ParametersType<Required<PluginHooks>>[T];
}) {
  if (!plugins) return args;

  let customArgs = args;

  for (const plugin of plugins) {
    const hook = plugin[hookName];
    if (hook) {
      const result = await (hook as (...args: any[]) => ReturnType<Required<PluginHooks>[T]>)(...customArgs);
      if (result === undefined || !argsHook) continue;
      customArgs = argsHook(customArgs, result);
    }
  }

  return customArgs;
}
